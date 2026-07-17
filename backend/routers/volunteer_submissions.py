import re
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
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
    "pending",
    "changes_requested",
}

ADMIN_REVIEW_ACTIONS = {
    "approved",
    "rejected",
    "changes_requested",
}


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
    Volunteer ki new temple submission pending status
    ke saath create karta hai.
    """

    submission_data = body.model_dump()

    columns = [
        "volunteer_id",
        *submission_data.keys(),
        "status",
    ]

    values = [
        volunteer["id"],
        *submission_data.values(),
        "pending",
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
    Update ke baad status dobara pending ho jayega.
    """

    updates = body.model_dump(
        exclude_none=True
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
                status = 'pending',
                admin_note = NULL,
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
        "pending",
        "under_review",
        "changes_requested",
        "approved",
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

        published_temple_id = (
            submission.get(
                "published_temple_id"
            )
        )

        if (
            body.action == "approved"
            and not published_temple_id
        ):
            base_slug = create_temple_slug(
                submission["temple_name"]
            )

            unique_slug = (
                f"{base_slug}-"
                f"{uuid4().hex[:6]}"
            )

            cursor.execute(
                """
                INSERT INTO temples (
                    uuid,
                    name,
                    slug,
                    primary_deity,
                    address,
                    city,
                    district,
                    state,
                    pincode,
                    latitude,
                    longitude,
                    description,
                    history,
                    status,
                    source,
                    submitted_by,
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
                    %s,
                    'published',
                    'volunteer',
                    %s,
                    FALSE
                )
                RETURNING id
                """,
                (
                    str(uuid4()),
                    submission["temple_name"],
                    unique_slug,
                    submission.get("deity"),
                    submission["address"],
                    submission["city"],
                    submission.get("district"),
                    submission["state"],
                    submission.get("pincode"),
                    submission.get("latitude"),
                    submission.get("longitude"),
                    submission.get("description"),
                    submission.get("history"),
                    (
                        "volunteer:"
                        f"{submission['volunteer_id']}"
                    ),
                ),
            )

            published_temple = (
                cursor.fetchone()
            )

            published_temple_id = (
                published_temple["id"]
            )

        cursor.execute(
            """
            UPDATE temple_submissions
            SET
                status = %s,
                admin_note = %s,
                reviewed_by = %s,
                reviewed_at = NOW(),
                published_temple_id = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (
                body.action,
                body.admin_note,
                admin["id"],
                published_temple_id,
                submission_id,
            ),
        )

        reviewed_submission = (
            cursor.fetchone()
        )

    return reviewed_submission