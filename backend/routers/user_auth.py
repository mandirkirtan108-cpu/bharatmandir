"""
routers/user_auth.py — JWT-based User Authentication with Email Verification
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
import bcrypt
import os
import secrets
import resend
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

resend.api_key = os.environ.get("RESEND_API_KEY", "")
FRONTEND_URL   = os.environ.get("FRONTEND_URL", "http://localhost:5173")


# ── Pydantic models ──────────────────────────────────────────────────
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


# ── Token helpers ────────────────────────────────────────────────────
def create_token(data: dict, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


# ── Email helper ─────────────────────────────────────────────────────
def send_verification_email(to_email: str, name: str, token: str):
    verify_url = f"{FRONTEND_URL}/verify-email?token={token}"
    try:
        resend.Emails.send({
            "from": "BharatMandir <onboarding@resend.dev>",
            "to": [to_email],
            "subject": "🛕 BharatMandir — Verify your email",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; 
                        background: #1a0a00; color: #fff; border-radius: 12px; padding: 40px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="font-size: 32px; margin: 0;">🛕</h1>
                    <h2 style="color: #ff9900; margin: 8px 0;">BharatMandir</h2>
                </div>
                <p style="font-size: 16px;">Namaste <strong>{name}</strong>,</p>
                <p style="color: #ccc;">
                    Aapka account BharatMandir pe create ho gaya hai. 
                    Email verify karne ke liye neeche button click karein.
                </p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="{verify_url}" 
                       style="background: #ff9900; color: #1a0a00; padding: 14px 32px; 
                              border-radius: 8px; text-decoration: none; 
                              font-weight: bold; font-size: 16px;">
                        ✅ Verify Email
                    </a>
                </div>
                <p style="color: #888; font-size: 13px;">
                    Ya ye link copy karein:<br/>
                    <a href="{verify_url}" style="color: #ff9900;">{verify_url}</a>
                </p>
                <p style="color: #666; font-size: 12px; margin-top: 24px;">
                    Ye link 24 ghante mein expire ho jaayega.
                    Agar aapne signup nahi kiya to is email ko ignore karein.
                </p>
            </div>
            """
        })
    except Exception as e:
        print(f"⚠️ Email send failed: {e}")


# ── DB helpers ───────────────────────────────────────────────────────
def get_user_by_email(email: str):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, email, name, password_hash, is_verified, is_active, created_at 
                   FROM users WHERE email = %s""",
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
                """SELECT id, email, name, is_verified, is_active, created_at 
                   FROM users WHERE id = %s""",
                (user_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = ['id', 'email', 'name', 'is_verified', 'is_active', 'created_at']
            return dict(zip(cols, row))


# ── Auth dependency ──────────────────────────────────────────────────
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


# ── Routes ───────────────────────────────────────────────────────────

@router.post("/signup", status_code=201)
async def signup(body: SignupRequest):
    # Validations
    if body.password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
    if get_user_by_email(body.email.lower()):
        raise HTTPException(status_code=409, detail="Email already registered")

    password_hash  = bcrypt.hashpw(body.password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')
    verify_token   = secrets.token_urlsafe(32)
    verify_expires = datetime.now(timezone.utc) + timedelta(hours=VERIFY_TOKEN_EXPIRE_HOURS)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO users (email, name, password_hash, email_verify_token, email_verify_expires)
                       VALUES (%s, %s, %s, %s, %s)
                       RETURNING id, email, name, is_verified""",
                    (body.email.lower(), body.name.strip(), password_hash, verify_token, verify_expires)
                )
                row = cur.fetchone()

        user_id, email, name, is_verified = row

        # ✉️ Verification email bhejo
        send_verification_email(email, name, verify_token)

        return {
            "message": "Account created! Verification email bheja gaya hai. Email check karein.",
            "token_type": "bearer",
            "user": {"id": user_id, "email": email, "name": name, "is_verified": is_verified},
        }

    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Email already registered")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify-email")
async def verify_email(body: VerifyEmailRequest):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id FROM users
                   WHERE email_verify_token = %s
                     AND email_verify_expires > NOW()
                     AND is_verified = FALSE""",
                (body.token,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=400, detail="Invalid or expired verification token")

            cur.execute(
                """UPDATE users
                   SET is_verified = TRUE, email_verify_token = NULL, email_verify_expires = NULL
                   WHERE id = %s
                   RETURNING id, email, name, is_verified""",
                (row[0],)
            )
            updated = cur.fetchone()

    user_id, email, name, is_verified = updated

    # Login token bhi de do verify hone ke baad
    access_token  = create_token({"sub": str(user_id), "type": "access"},  timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    refresh_token = create_token({"sub": str(user_id), "type": "refresh"}, timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))

    return {
        "message": "Email verified successfully! 🎉",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {"id": user_id, "email": email, "name": name, "is_verified": is_verified},
    }


@router.post("/login")
async def login(body: LoginRequest):
    user = get_user_by_email(body.email.lower())
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account deactivated. Contact support.")
    if not bcrypt.checkpw(body.password.encode('utf-8'), user["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # ⚠️ Email verify nahi ki to login mat karne do
    if not user["is_verified"]:
        raise HTTPException(status_code=403, detail="Email verify nahi ki. Inbox check karein.")

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