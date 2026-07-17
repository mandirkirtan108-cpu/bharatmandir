import os
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
from pydantic import BaseModel, Field
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from jose import JWTError, jwt

from db.connection import get_db_cursor
from models.volunteer import (
    RefreshRequest,
    VolunteerLogin,
    VolunteerProfileUpdate,
    VolunteerSignup,
)
from routers.admin_auth import get_current_admin


class VolunteerApprovalRequest(BaseModel):
    action: Literal["approved", "rejected"]
    rejection_reason: str | None = Field(default=None, max_length=2000)

router = APIRouter(
    prefix="/api/volunteer/auth",
    tags=["Volunteer Authentication"],
)

security = HTTPBearer(
    auto_error=False
)

JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "change-this-secret-in-production",
)

JWT_ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "VOLUNTEER_ACCESS_TOKEN_MINUTES",
        "60",
    )
)

REFRESH_TOKEN_EXPIRE_DAYS = int(
    os.getenv(
        "VOLUNTEER_REFRESH_TOKEN_DAYS",
        "7",
    )
)


def create_volunteer_token(
    volunteer_id: int,
    token_type: str,
    expires_delta: timedelta,
) -> str:
    """
    Volunteer access ya refresh JWT token create karta hai.
    """

    expires_at = (
        datetime.now(timezone.utc)
        + expires_delta
    )

    payload = {
        "sub": str(volunteer_id),
        "type": token_type,
        "portal": "volunteer",
        "role": "volunteer",
        "iat": datetime.now(timezone.utc),
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def decode_volunteer_token(
    token: str,
) -> dict[str, Any]:
    """
    Volunteer JWT token verify aur decode karta hai.
    """

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )
    except JWTError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Invalid or expired volunteer token"
            ),
            headers={
                "WWW-Authenticate": "Bearer"
            },
        ) from error

    if payload.get("portal") != "volunteer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Volunteer access required",
        )

    if not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid volunteer token",
        )

    return payload


def public_volunteer(
    volunteer: dict | None,
) -> dict | None:
    """
    Password hash ko response se remove karke safe
    volunteer object return karta hai.
    """

    if not volunteer:
        return None

    allowed_fields = (
        "id",
        "uuid",
        "name",
        "email",
        "phone",
        "city",
        "state",
        "is_active",
        "created_at",
        "updated_at",
        "approval_status",
        "approved_by",
        "approved_at",
        "rejection_reason",
        "registered_at",
    )

    return {
        field: volunteer[field]
        for field in allowed_fields
        if field in volunteer
    }


def hash_password(
    password: str,
) -> str:
    password_bytes = password.encode("utf-8")

    password_hash = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt(rounds=12),
    )

    return password_hash.decode("utf-8")


def verify_password(
    password: str,
    password_hash: str,
) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


async def get_current_volunteer(
    credentials: (
        HTTPAuthorizationCredentials | None
    ) = Depends(security),
) -> dict:
    """
    Protected volunteer routes ke liye current
    volunteer return karta hai.
    """

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Volunteer authentication required",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    payload = decode_volunteer_token(
        credentials.credentials
    )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token type",
        )

    try:
        volunteer_id = int(payload["sub"])
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid volunteer identity",
        ) from error

    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT *
            FROM volunteers
            WHERE id = %s
            """,
            (volunteer_id,),
        )

        volunteer = cursor.fetchone()

    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Volunteer account not found",
        )

    if not volunteer["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Volunteer account is deactivated",
        )

    if volunteer.get("approval_status") != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Volunteer account is not approved",
        )

    return volunteer


@router.post(
    "/signup",
    status_code=status.HTTP_201_CREATED,
)
def signup_volunteer(
    body: VolunteerSignup,
):
    """
    Naya volunteer account create karta hai.
    """

    normalized_email = (
        body.email.strip().lower()
    )

    password_hash = hash_password(
        body.password
    )

    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO volunteers (
                    name,
                    email,
                    password_hash,
                    phone,
                    city,
                    state,
                    approval_status
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    'pending'
                )
                RETURNING *
                """,
                (
                    body.name.strip(),
                    normalized_email,
                    password_hash,
                    (
                        body.phone.strip()
                        if body.phone
                        else None
                    ),
                    (
                        body.city.strip()
                        if body.city
                        else None
                    ),
                    (
                        body.state.strip()
                        if body.state
                        else None
                    ),
                ),
            )

            volunteer = cursor.fetchone()

    except Exception as error:
        error_message = str(error).lower()

        if (
            "unique" in error_message
            or "duplicate" in error_message
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This email is already registered"
                ),
            ) from error

        raise

    return {
        "message": (
            "Registration submitted successfully. Your account is currently under review by the administrator. You'll be notified once it has been approved."
        ),
        "volunteer": public_volunteer(
            volunteer
        ),
    }


@router.post("/login")
def login_volunteer(
    body: VolunteerLogin,
):
    """
    Volunteer email/password verify karke access aur
    refresh tokens return karta hai.
    """

    normalized_email = (
        body.email.strip().lower()
    )

    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT *
            FROM volunteers
            WHERE email = %s
            """,
            (normalized_email,),
        )

        volunteer = cursor.fetchone()

    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    password_valid = verify_password(
        body.password,
        volunteer["password_hash"],
    )

    if not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not volunteer["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Volunteer account is deactivated",
        )

    approval_status = volunteer.get("approval_status") or "pending"
    if approval_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your volunteer account is currently under review by the administrator. You will be able to access your dashboard once your account has been approved.",
        )
    if approval_status == "rejected":
        reason = volunteer.get("rejection_reason")
        message = "Your volunteer registration was rejected."
        if reason:
            message += f" Admin remarks: {reason}"
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)

    access_token = create_volunteer_token(
        volunteer_id=volunteer["id"],
        token_type="access",
        expires_delta=timedelta(
            minutes=(
                ACCESS_TOKEN_EXPIRE_MINUTES
            )
        ),
    )

    refresh_token = create_volunteer_token(
        volunteer_id=volunteer["id"],
        token_type="refresh",
        expires_delta=timedelta(
            days=REFRESH_TOKEN_EXPIRE_DAYS
        ),
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": (
            ACCESS_TOKEN_EXPIRE_MINUTES * 60
        ),
        "volunteer": public_volunteer(
            volunteer
        ),
    }


@router.post("/refresh")
def refresh_volunteer_token(
    body: RefreshRequest,
):
    """
    Valid refresh token se naya access token banata hai.
    """

    payload = decode_volunteer_token(
        body.refresh_token
    )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token type",
        )

    try:
        volunteer_id = int(payload["sub"])
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid volunteer identity",
        ) from error

    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id, is_active, approval_status
            FROM volunteers
            WHERE id = %s
            """,
            (volunteer_id,),
        )

        volunteer = cursor.fetchone()

    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Volunteer account not found",
        )

    if not volunteer["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Volunteer account is deactivated",
        )
    if volunteer.get("approval_status") != "approved":
        raise HTTPException(status_code=403, detail="Volunteer account is not approved")

    access_token = create_volunteer_token(
        volunteer_id=volunteer_id,
        token_type="access",
        expires_delta=timedelta(
            minutes=(
                ACCESS_TOKEN_EXPIRE_MINUTES
            )
        ),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": (
            ACCESS_TOKEN_EXPIRE_MINUTES * 60
        ),
    }


@router.get("/me")
def get_volunteer_profile(
    volunteer: dict = Depends(
        get_current_volunteer
    ),
):
    return public_volunteer(volunteer)


@router.patch("/profile")
def update_volunteer_profile(
    body: VolunteerProfileUpdate,
    volunteer: dict = Depends(
        get_current_volunteer
    ),
):
    """
    Volunteer name, phone, city aur state update karta hai.
    """

    updates = body.model_dump(
        exclude_none=True
    )

    allowed_fields = {
        "name",
        "phone",
        "city",
        "state",
    }

    updates = {
        key: value.strip()
        if isinstance(value, str)
        else value
        for key, value in updates.items()
        if key in allowed_fields
    }

    if not updates:
        return public_volunteer(volunteer)

    if (
        "name" in updates
        and not updates["name"]
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Volunteer name cannot be empty",
        )

    update_clause = ", ".join(
        f"{field} = %s"
        for field in updates
    )

    update_values = list(
        updates.values()
    )

    with get_db_cursor() as cursor:
        cursor.execute(
            f"""
            UPDATE volunteers
            SET
                {update_clause},
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            [
                *update_values,
                volunteer["id"],
            ],
        )

        updated_volunteer = (
            cursor.fetchone()
        )

    return public_volunteer(
        updated_volunteer
    )


@router.post("/logout")
def logout_volunteer():
    """
    JWT stateless hai, isliye frontend local tokens clear
    karega. Endpoint consistent API response deta hai.
    """

    return {
        "message": (
            "Volunteer logged out successfully"
        )
    }


@router.get("/admin/volunteers")
def admin_list_volunteers(
    approval_status: str | None = None,
    admin: dict = Depends(get_current_admin),
):
    allowed = {"pending", "approved", "rejected"}
    if approval_status and approval_status not in allowed:
        raise HTTPException(status_code=422, detail="Invalid approval status")
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id, uuid, name, email, phone, city, state, is_active,
                   approval_status, approved_by, approved_at,
                   rejection_reason, registered_at, created_at
            FROM volunteers
            WHERE (%s IS NULL OR approval_status = %s)
            ORDER BY registered_at DESC, created_at DESC
            """,
            (approval_status, approval_status),
        )
        return cursor.fetchall()


@router.get("/admin/volunteers/{volunteer_id}")
def admin_get_volunteer(
    volunteer_id: int,
    admin: dict = Depends(get_current_admin),
):
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM volunteers WHERE id = %s", (volunteer_id,))
        volunteer = cursor.fetchone()
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    return public_volunteer(volunteer)


@router.patch("/admin/volunteers/{volunteer_id}/approval")
def admin_review_volunteer(
    volunteer_id: int,
    body: VolunteerApprovalRequest,
    admin: dict = Depends(get_current_admin),
):
    if body.action == "rejected" and not (body.rejection_reason or "").strip():
        raise HTTPException(status_code=422, detail="Rejection reason is required")
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            UPDATE volunteers
            SET approval_status = %s,
                approved_by = CASE WHEN %s = 'approved' THEN %s ELSE NULL END,
                approved_at = CASE WHEN %s = 'approved' THEN NOW() ELSE NULL END,
                rejection_reason = CASE WHEN %s = 'rejected' THEN %s ELSE NULL END,
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (body.action, body.action, admin["id"], body.action,
             body.action, body.rejection_reason, volunteer_id),
        )
        volunteer = cursor.fetchone()
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    return public_volunteer(volunteer)
