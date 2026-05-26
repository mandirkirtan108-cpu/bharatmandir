"""
routers/user_auth.py — JWT-based User Authentication
Handles: signup, login, me, refresh, verify-email
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
import bcrypt
import os
import secrets
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt

from db.connection import get_db_connection

router = APIRouter(prefix="/api/auth", tags=["User Auth"])
security = HTTPBearer()

JWT_SECRET    = os.environ.get("JWT_SECRET", "change-this-secret-in-production-NOW")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
REFRESH_TOKEN_EXPIRE_DAYS   = 30
VERIFY_TOKEN_EXPIRE_HOURS   = 24


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirm_password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class VerifyEmailRequest(BaseModel):
    token: str


def create_token(data: dict, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


def get_user_by_email(email: str):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, name, password_hash, is_verified, is_active, created_at FROM users WHERE email = %s",
                (email,)
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = ['id', 'email', 'name', 'password_hash', 'is_verified', 'is_active', 'created_at']
            return dict(zip(cols, row))

def get_user_by_id(user_id: int):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, name, is_verified, is_active, created_at FROM users WHERE id = %s",
                (user_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = ['id', 'email', 'name', 'is_verified', 'is_active', 'created_at']
            return dict(zip(cols, row))


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = get_user_by_id(int(user_id))
    if not user or not user["is_active"]:
        raise HTTPException(status_code=401, detail="User not found or deactivated")
    return user


@router.post("/signup", status_code=201)
async def signup(body: SignupRequest):
    if body.password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")

    if get_user_by_email(body.email):
        raise HTTPException(status_code=409, detail="Email already registered")

    password_hash = bcrypt.hashpw(
        body.password.encode('utf-8'), bcrypt.gensalt(rounds=12)
    ).decode('utf-8')

    verify_token   = secrets.token_urlsafe(32)
    verify_expires = datetime.now(timezone.utc) + timedelta(hours=VERIFY_TOKEN_EXPIRE_HOURS)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (email, name, password_hash, email_verify_token, email_verify_expires)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, email, name, is_verified, created_at
                    """,
                    (body.email.lower(), body.name.strip(), password_hash, verify_token, verify_expires)
                )
                row = cur.fetchone()

        user_id, email, name, is_verified, created_at = row
        access_token  = create_token({"sub": str(user_id), "type": "access"},  timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
        refresh_token = create_token({"sub": str(user_id), "type": "refresh"}, timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))

        return {
            "message": "Account created successfully.",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {"id": user_id, "email": email, "name": name, "is_verified": is_verified},
            "verify_token": verify_token,
        }
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Email already registered")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
async def login(body: LoginRequest):
    user = get_user_by_email(body.email.lower())
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account deactivated. Contact support.")
    if not bcrypt.checkpw(body.password.encode('utf-8'), user["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token  = create_token({"sub": str(user["id"]), "type": "access"},  timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    refresh_token = create_token({"sub": str(user["id"]), "type": "refresh"}, timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE users SET last_login_at = NOW() WHERE id = %s", (user["id"],))
    except Exception:
        pass

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"], "name": user["name"], "is_verified": user["is_verified"]},
    }


@router.post("/refresh")
async def refresh_token_endpoint(body: RefreshRequest):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")
    user = get_user_by_id(int(payload.get("sub")))
    if not user or not user["is_active"]:
        raise HTTPException(status_code=401, detail="User not found or deactivated")
    new_access = create_token({"sub": str(user["id"]), "type": "access"}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": new_access, "token_type": "bearer"}


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


@router.post("/verify-email")
async def verify_email(body: VerifyEmailRequest):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM users WHERE email_verify_token = %s AND email_verify_expires > NOW() AND is_verified = FALSE",
                (body.token,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=400, detail="Invalid or expired verification token")
            cur.execute(
                "UPDATE users SET is_verified = TRUE, email_verify_token = NULL, email_verify_expires = NULL WHERE id = %s",
                (row[0],)
            )
    return {"message": "Email verified successfully"}