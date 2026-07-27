import re
from uuid import uuid4

from psycopg2.extras import Json

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)

from db.connection import get_db_cursor
from models.temple_submission import (
    ReviewRequest,
    TempleSubmissionCreate,
    TempleSubmissionUpdate,
)
from routers.admin_auth import (
    get_current_admin,
)
from routers.volunteer_auth import (
    get_current_volunteer,
)
from services.cloudinary_service import delete_file, upload_file

router = APIRouter(
    prefix="/api",
    tags=["Volunteer Temple Submissions"],
)

VOLUNTEER_EDITABLE_STATUSES = {
    "draft",
    "changes_requested",
}

VOLUNTEER_DELETABLE_STATUSES = {
    "draft",
    "changes_requested",
}

ADMIN_REVIEW_ACTIONS = {
    "approved",
    "published",
    "rejected",
    "changes_requested",
}

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
MAX_IMAGE_SIZE = 10 * 1024 * 1024


async def upload_submission_image(
    image: UploadFile,
    prefix: str,
) -> dict:
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPG, PNG and WebP images are supported",
        )

    content = await image.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{image.filename or 'Image'} is empty",
        )
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{image.filename or 'Image'} exceeds the 10 MB limit",
        )

    try:
        return upload_file(
            content,
            image.filename or "temple-image.jpg",
            prefix=prefix,
            resource_type="image",
        )
    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The temple photo could not be uploaded",
        ) from error


def create_temple_slug(
    temple_name: str,
) -> str:
    """
    Temple name ko URL-safe slug mein convert karta hai.
    """

    normalized_name = (
        temple_name.lower().strip()
    )

    slug = re.sub(
        r"[^a-z0-9]+",
        "-",
        normalized_name,
    ).strip("-")

    if not slug:
        slug = (
            f"temple-{uuid4().hex[:8]}"
        )

    return slug


def get_volunteer_submission(
    submission_id: int,
    volunteer_id: int,
) -> dict:
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT *
            FROM temple_submissions
            WHERE
                id = %s
                AND volunteer_id = %s
            """,
            (
                submission_id,
                volunteer_id,
            ),
        )

        submission = cursor.fetchone()

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Temple submission not found",
        )

    return submission


@router.post(
    "/volunteer/submissions",
    status_code=status.HTTP_201_CREATED,
)
def create_volunteer_submission(
    body: TempleSubmissionCreate,
    volunteer: dict = Depends(
        get_current_volunteer
    ),
):
    """
    New submissions always start as a private draft.
    """

    submission_data = body.model_dump()

    submission_data["form_payload"] = Json(
        submission_data.get("form_payload") or {}
    )

    columns = [
        "volunteer_id",
        *submission_data.keys(),
        "status",
    ]

    values = [
        volunteer["id"],
        *submission_data.values(),
        "draft",
    ]

    placeholders = ", ".join(
        ["%s"] * len(values)
    )

    column_names = ", ".join(columns)

    with get_db_cursor() as cursor:
        cursor.execute(
            f"""
            INSERT INTO temple_submissions (
                {column_names}
            )
            VALUES (
                {placeholders}
            )
            RETURNING *
            """,
            values,
        )

        submission = cursor.fetchone()

    return submission


@router.get("/volunteer/submissions")
def list_volunteer_submissions(
    volunteer: dict = Depends(
        get_current_volunteer
    ),
):
    """
    Logged-in volunteer ki sabhi submissions return karta hai.
    """

    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT *
            FROM temple_submissions
            WHERE volunteer_id = %s
            ORDER BY created_at DESC
            """,
            (volunteer["id"],),
        )

        submissions = cursor.fetchall()

    return submissions


@router.get(
    "/volunteer/submissions/{submission_id}"
)
def get_single_volunteer_submission(
    submission_id: int,
    volunteer: dict = Depends(
        get_current_volunteer
    ),
):
    return get_volunteer_submission(
        submission_id=submission_id,
        volunteer_id=volunteer["id"],
    )


@router.patch(
    "/volunteer/submissions/{submission_id}"
)
def update_volunteer_submission(
    submission_id: int,
    body: TempleSubmissionUpdate,
    volunteer: dict = Depends(
        get_current_volunteer
    ),
):
    """
    Draft ya changes-requested submission update karta hai.
    Editing preserves draft/changes-requested status.
    """

    updates = body.model_dump(
        exclude_unset=True
    )

    if "form_payload" in updates:
        updates["form_payload"] = Json(
            updates["form_payload"] or {}
        )

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields provided for update",
        )

    current_submission = (
        get_volunteer_submission(
            submission_id=submission_id,
            volunteer_id=volunteer["id"],
        )
    )

    if (
        current_submission["status"]
        not in VOLUNTEER_EDITABLE_STATUSES
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only draft or changes-requested "
                "submissions can be edited"
            ),
        )

    update_clause = ", ".join(
        f"{field} = %s"
        for field in updates
    )

    values = [
        *updates.values(),
        submission_id,
        volunteer["id"],
    ]

    with get_db_cursor() as cursor:
        cursor.execute(
            f"""
            UPDATE temple_submissions
            SET
                {update_clause},
                updated_at = NOW()
            WHERE
                id = %s
                AND volunteer_id = %s
            RETURNING *
            """,
            values,
        )

        updated_submission = (
            cursor.fetchone()
        )

    if not updated_submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Temple submission not found",
        )

    return updated_submission


@router.post("/volunteer/submissions/{submission_id}/media")
async def upload_volunteer_submission_media(
    submission_id: int,
    hero_image: UploadFile | None = File(default=None),
    gallery_images: list[UploadFile] = File(default=[]),
    volunteer: dict = Depends(get_current_volunteer),
):
    """Upload volunteer temple photos and store their permanent Cloudinary URLs."""
    current = get_volunteer_submission(submission_id, volunteer["id"])
    if current["status"] not in VOLUNTEER_EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Photos can only be changed while the submission is editable",
        )

    gallery_files = [
        image for image in gallery_images
        if image and image.filename
    ]
    if not (hero_image and hero_image.filename) and not gallery_files:
        return {
            "image_url": current.get("image_url"),
            "media": (current.get("form_payload") or {}).get("_uploaded_media", []),
        }

    uploaded_media: list[dict] = []
    uploaded_public_ids: list[str] = []
    try:
        if hero_image and hero_image.filename:
            uploaded = await upload_submission_image(
                hero_image,
                prefix=f"submission-{submission_id}-hero-",
            )
            uploaded_public_ids.append(uploaded["public_id"])
            uploaded_media.append({
                "url": uploaded["url"],
                "public_id": uploaded["public_id"],
                "file_name": hero_image.filename,
                "is_hero": True,
                "sort_order": 0,
            })

        for index, image in enumerate(gallery_files, start=1):
            uploaded = await upload_submission_image(
                image,
                prefix=f"submission-{submission_id}-gallery-{index}-",
            )
            uploaded_public_ids.append(uploaded["public_id"])
            uploaded_media.append({
                "url": uploaded["url"],
                "public_id": uploaded["public_id"],
                "file_name": image.filename,
                "is_hero": False,
                "sort_order": index,
            })
    except Exception:
        for public_id in uploaded_public_ids:
            delete_file(public_id, resource_type="image")
        raise

    payload = dict(current.get("form_payload") or {})
    previous_media = payload.get("_uploaded_media") or []
    payload["_uploaded_media"] = uploaded_media
    hero_url = next(
        (item["url"] for item in uploaded_media if item["is_hero"]),
        current.get("image_url"),
    )

    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                UPDATE temple_submissions
                SET image_url = %s, form_payload = %s, updated_at = NOW()
                WHERE id = %s AND volunteer_id = %s
                RETURNING image_url, form_payload
                """,
                (
                    hero_url,
                    Json(payload),
                    submission_id,
                    volunteer["id"],
                ),
            )
            updated = cursor.fetchone()
    except Exception:
        for public_id in uploaded_public_ids:
            delete_file(public_id, resource_type="image")
        raise

    for item in previous_media:
        old_public_id = item.get("public_id") if isinstance(item, dict) else None
        if old_public_id and old_public_id not in uploaded_public_ids:
            delete_file(old_public_id, resource_type="image")

    return {
        "image_url": updated["image_url"],
        "media": updated["form_payload"].get("_uploaded_media", []),
    }


@router.post("/volunteer/submissions/{submission_id}/submit")
def submit_volunteer_submission(
    submission_id: int,
    volunteer: dict = Depends(get_current_volunteer),
):
    """Move an owned draft into the admin review queue."""
    current = get_volunteer_submission(submission_id, volunteer["id"])
    missing = [field for field in ("temple_name", "address", "city", "state") if not current.get(field)]
    if missing:
        raise HTTPException(status_code=422, detail=f"Complete required fields before submitting: {', '.join(missing)}")
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            UPDATE temple_submissions
            SET status = 'pending_review', submitted_at = NOW(),
                admin_note = NULL, rejection_reason = NULL, updated_at = NOW()
            WHERE id = %s AND volunteer_id = %s
              AND status IN ('draft', 'changes_requested')
            RETURNING *
            """,
            (submission_id, volunteer["id"]),
        )
        submission = cursor.fetchone()
    if not submission:
        raise HTTPException(status_code=409, detail="Only drafts or change requests can be submitted")
    return submission


@router.delete(
    "/volunteer/submissions/{submission_id}"
)
def delete_volunteer_submission(
    submission_id: int,
    volunteer: dict = Depends(
        get_current_volunteer
    ),
):
    """
    Draft, pending ya changes-requested submission delete
    karne deta hai.
    """

    status_placeholders = ", ".join(
        ["%s"]
        * len(VOLUNTEER_DELETABLE_STATUSES)
    )

    allowed_statuses = tuple(
        VOLUNTEER_DELETABLE_STATUSES
    )

    with get_db_cursor() as cursor:
        cursor.execute(
            f"""
            DELETE FROM temple_submissions
            WHERE
                id = %s
                AND volunteer_id = %s
                AND status IN (
                    {status_placeholders}
                )
            RETURNING id
            """,
            (
                submission_id,
                volunteer["id"],
                *allowed_statuses,
            ),
        )

        deleted_submission = (
            cursor.fetchone()
        )

    if not deleted_submission:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Submission cannot be deleted. "
                "It may already be under review or approved."
            ),
        )

    return {
        "message": (
            "Temple submission deleted successfully"
        ),
        "submission_id": submission_id,
    }


@router.get(
    "/admin/volunteer-submissions"
)
def list_submissions_for_admin(
    submission_status: str | None = Query(
        default=None,
        alias="status",
    ),
    admin: dict = Depends(
        get_current_admin
    ),
):
    """
    Admin ke liye sabhi volunteer submissions return karta hai.
    Optional status filter supported hai.
    """

    valid_statuses = {
        "draft",
        "pending_review",
        "changes_requested",
        "published",
        "rejected",
    }

    if (
        submission_status
        and submission_status
        not in valid_statuses
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid submission status",
        )

    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT
                submission.*,
                volunteer.name
                    AS volunteer_name,
                volunteer.email
                    AS volunteer_email,
                volunteer.phone
                    AS volunteer_phone
            FROM temple_submissions
                AS submission
            JOIN volunteers
                AS volunteer
                ON volunteer.id =
                   submission.volunteer_id
            WHERE (
                %s IS NULL
                OR submission.status = %s
            )
            ORDER BY
                submission.created_at DESC
            """,
            (
                submission_status,
                submission_status,
            ),
        )

        submissions = cursor.fetchall()

    return submissions


@router.get(
    "/admin/volunteer-submissions/{submission_id}"
)
def get_submission_for_admin(
    submission_id: int,
    admin: dict = Depends(
        get_current_admin
    ),
):
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT
                submission.*,
                volunteer.name
                    AS volunteer_name,
                volunteer.email
                    AS volunteer_email,
                volunteer.phone
                    AS volunteer_phone
            FROM temple_submissions
                AS submission
            JOIN volunteers
                AS volunteer
                ON volunteer.id =
                   submission.volunteer_id
            WHERE submission.id = %s
            """,
            (submission_id,),
        )

        submission = cursor.fetchone()

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Temple submission not found",
        )

    return submission


@router.post(
    "/admin/volunteer-submissions/"
    "{submission_id}/review"
)
def review_volunteer_submission(
    submission_id: int,
    body: ReviewRequest,
    admin: dict = Depends(
        get_current_admin
    ),
):
    """
    Admin submission approve, reject ya changes request karta hai.
    Approval par main temples table mein temple create hota hai.
    """

    if body.action not in ADMIN_REVIEW_ACTIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid review action",
        )

    if (
        body.action in {
            "rejected",
            "changes_requested",
        }
        and not body.admin_note
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Admin note is required for rejection "
                "or changes request"
            ),
        )

    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT *
            FROM temple_submissions
            WHERE id = %s
            """,
            (submission_id,),
        )

        submission = cursor.fetchone()

        if not submission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    "Temple submission not found"
                ),
            )

        review_action = "published" if body.action == "approved" else body.action

        if (
            review_action == "published"
        ):
            base_slug = create_temple_slug(
                submission["temple_name"]
            )

            unique_slug = (
                f"{base_slug}-"
                f"{uuid4().hex[:6]}"
            )

            state_code = re.sub(
                r"[^A-Za-z]",
                "",
                submission.get("state") or "IN",
            )[:2].upper() or "IN"
            mkt_id = (
                f"MKT-{state_code}-"
                f"{uuid4().hex[:6].upper()}"
            )
            form_payload = submission.get("form_payload") or {}
            uploaded_media = (
                form_payload.get("_uploaded_media") or []
                if isinstance(form_payload, dict)
                else []
            )
            hero_image_url = submission.get("image_url") or next(
                (
                    item.get("url")
                    for item in uploaded_media
                    if isinstance(item, dict) and item.get("is_hero")
                ),
                None,
            )

            cursor.execute(
                """
                INSERT INTO temples (
                    uuid,
                    name,
                    slug,
                    mkt_id,
                    primary_deity,
                    address,
                    city,
                    district,
                    state,
                    pincode,
                    latitude,
                    longitude,
                    location,
                    significance,
                    history,
                    hero_image_url,
                    status,
                    source,
                    verified
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    CASE
                        WHEN %s IS NOT NULL AND %s IS NOT NULL
                        THEN ST_GeogFromText(
                            'POINT(' || %s || ' ' || %s || ')'
                        )
                        ELSE NULL
                    END,
                    %s,
                    %s,
                    %s,
                    'published',
                    'manual',
                    TRUE
                )
                RETURNING id
                """,
                (
                    str(uuid4()),
                    submission["temple_name"],
                    unique_slug,
                    mkt_id,
                    submission.get("deity"),
                    submission["address"],
                    submission["city"],
                    submission.get("district"),
                    submission["state"],
                    submission.get("pincode"),
                    submission.get("latitude"),
                    submission.get("longitude"),
                    submission.get("latitude"),
                    submission.get("longitude"),
                    submission.get("longitude"),
                    submission.get("latitude"),
                    submission.get("description"),
                    submission.get("history"),
                    hero_image_url,
                ),
            )

            published_temple = (
                cursor.fetchone()
            )

            for item in uploaded_media:
                if (
                    not isinstance(item, dict)
                    or item.get("is_hero")
                    or not item.get("url")
                ):
                    continue
                cursor.execute(
                    """
                    INSERT INTO temple_media (
                        temple_id,
                        media_type,
                        file_url,
                        file_name,
                        caption,
                        is_hero,
                        sort_order,
                        cloudinary_public_id
                    )
                    VALUES (
                        %s, 'image', %s, %s, NULL,
                        FALSE, %s, %s
                    )
                    """,
                    (
                        published_temple["id"],
                        item["url"],
                        item.get("file_name"),
                        item.get("sort_order", 1),
                        item.get("public_id"),
                    ),
                )

        cursor.execute(
            """
            UPDATE temple_submissions
            SET
                status = %s,
                admin_note = %s,
                rejection_reason = CASE WHEN %s = 'rejected' THEN %s ELSE NULL END,
                reviewed_by = %s,
                reviewed_at = NOW(),
                published_at = CASE WHEN %s = 'published' THEN NOW() ELSE published_at END,
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (
                review_action,
                body.admin_note,
                review_action,
                body.admin_note,
                admin["id"],
                review_action,
                submission_id,
            ),
        )

        reviewed_submission = (
            cursor.fetchone()
        )

    return reviewed_submission
