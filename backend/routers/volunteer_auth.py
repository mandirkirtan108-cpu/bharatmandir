import os
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
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
                    state
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
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
            "Volunteer account created successfully"
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
            SELECT id, is_active
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