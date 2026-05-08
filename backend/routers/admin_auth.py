"""
routers/admin_auth.py — JWT-based Admin Authentication
Handles: login, logout, token refresh, admin CRUD (super_admin only)
Uses get_db_connection() context manager from db.connection
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import bcrypt
import json
import os
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt

from db.connection import get_db_connection  # ← tumhara actual import

router = APIRouter(prefix="/api/admin/auth", tags=["Admin Auth"])
security = HTTPBearer()

# ── Config ──────────────────────────────────────────────────────────
JWT_SECRET     = os.environ.get("JWT_SECRET", "change-this-secret-in-production-NOW")
JWT_ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60   # 1 hour
REFRESH_TOKEN_EXPIRE_DAYS   = 7


# ── Pydantic models ─────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    admin: dict

class CreateAdminRequest(BaseModel):
    email: str
    full_name: str
    password: str
    role: str = "moderator"

class RefreshRequest(BaseModel):
    refresh_token: str


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


# ── DB helpers — using get_db_connection() context manager ───────────
def get_admin_by_email(email: str):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, uuid, email, password_hash, full_name, role, is_active, last_login_at
                FROM admin_users WHERE email = %s
                """,
                (email,)
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = ['id', 'uuid', 'email', 'password_hash', 'full_name', 'role', 'is_active', 'last_login_at']
            return dict(zip(cols, row))


def get_admin_by_id(admin_id: int):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, uuid, email, full_name, role, is_active, last_login_at, created_at
                FROM admin_users WHERE id = %s
                """,
                (admin_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = ['id', 'uuid', 'email', 'full_name', 'role', 'is_active', 'last_login_at', 'created_at']
            return dict(zip(cols, row))


def update_last_login(admin_id: int):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE admin_users SET last_login_at = NOW() WHERE id = %s",
                (admin_id,)
            )
        # get_db_connection auto-commits on exit ✅


def log_activity(admin_id: int, action: str, target_type: str = None,
                 target_id: int = None, details: dict = None, ip: str = None):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO admin_activity_log
                        (admin_id, action, target_type, target_id, details, ip_address)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (admin_id, action, target_type, target_id,
                     json.dumps(details) if details else None, ip)
                )
    except Exception:
        pass  # Never let logging break the main flow


# ── Auth dependencies ────────────────────────────────────────────────
async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    admin_id = payload.get("sub")
    if not admin_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    admin = get_admin_by_id(int(admin_id))
    if not admin or not admin["is_active"]:
        raise HTTPException(status_code=401, detail="Admin not found or deactivated")
    return admin

async def require_super_admin(admin: dict = Depends(get_current_admin)):
    if admin["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return admin

async def require_editor_or_above(admin: dict = Depends(get_current_admin)):
    if admin["role"] not in ("super_admin", "editor"):
        raise HTTPException(status_code=403, detail="Editor access required")
    return admin


# ── Routes ───────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request):
    admin = get_admin_by_email(body.email)

    if not admin:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not admin["is_active"]:
        raise HTTPException(status_code=403, detail="Account deactivated. Contact super admin.")
    if not bcrypt.checkpw(body.password.encode('utf-8'), admin["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_token(
        {"sub": str(admin["id"]), "role": admin["role"], "type": "access"},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_token(
        {"sub": str(admin["id"]), "type": "refresh"},
        timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )

    update_last_login(admin["id"])
    log_activity(admin["id"], "login", ip=request.client.host)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "admin": {
            "id": admin["id"],
            "uuid": str(admin["uuid"]),
            "email": admin["email"],
            "full_name": admin["full_name"],
            "role": admin["role"],
        }
    }


@router.post("/refresh")
async def refresh_token_endpoint(body: RefreshRequest):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")
    admin = get_admin_by_id(int(payload.get("sub")))
    if not admin or not admin["is_active"]:
        raise HTTPException(status_code=401, detail="Admin not found or deactivated")
    new_access = create_token(
        {"sub": str(admin["id"]), "role": admin["role"], "type": "access"},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": new_access, "token_type": "bearer"}


@router.get("/me")
async def get_me(admin: dict = Depends(get_current_admin)):
    return {k: v for k, v in admin.items() if k != "password_hash"}


@router.post("/logout")
async def logout(request: Request, admin: dict = Depends(get_current_admin)):
    log_activity(admin["id"], "logout", ip=request.client.host)
    return {"message": "Logged out successfully"}


# ── Admin management (super_admin only) ─────────────────────────────

@router.get("/admins")
async def list_admins(admin: dict = Depends(require_super_admin)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, uuid, email, full_name, role, is_active, last_login_at, created_at
                FROM admin_users ORDER BY created_at DESC
                """
            )
            cols = ['id', 'uuid', 'email', 'full_name', 'role', 'is_active', 'last_login_at', 'created_at']
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            for r in rows:
                r['uuid'] = str(r['uuid'])
                r['last_login_at'] = r['last_login_at'].isoformat() if r['last_login_at'] else None
                r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
            return rows


@router.post("/admins")
async def create_admin_user(body: CreateAdminRequest, request: Request,
                            admin: dict = Depends(require_super_admin)):
    if body.role not in ("super_admin", "editor", "moderator"):
        raise HTTPException(status_code=400, detail="Invalid role")

    password_hash = bcrypt.hashpw(
        body.password.encode('utf-8'), bcrypt.gensalt(rounds=12)
    ).decode('utf-8')

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO admin_users (email, password_hash, full_name, role)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, uuid, email, full_name, role
                    """,
                    (body.email, password_hash, body.full_name, body.role)
                )
                row = cur.fetchone()

        log_activity(admin["id"], "admin_created", target_type="admin_user",
                     details={"email": body.email, "role": body.role}, ip=request.client.host)

        return {"id": row[0], "uuid": str(row[1]), "email": row[2],
                "full_name": row[3], "role": row[4]}

    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Email already registered")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/admins/{admin_id}/deactivate")
async def deactivate_admin(admin_id: int, request: Request,
                           admin: dict = Depends(require_super_admin)):
    if admin_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE admin_users SET is_active = FALSE, updated_at = NOW() WHERE id = %s RETURNING id",
                (admin_id,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Admin not found")

    log_activity(admin["id"], "admin_deactivated", target_type="admin_user",
                 target_id=admin_id, ip=request.client.host)
    return {"message": "Admin deactivated"}


@router.patch("/admins/{admin_id}/role")
async def change_role(admin_id: int, body: dict, request: Request,
                      admin: dict = Depends(require_super_admin)):
    new_role = body.get("role")
    if new_role not in ("super_admin", "editor", "moderator"):
        raise HTTPException(status_code=400, detail="Invalid role")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE admin_users SET role = %s, updated_at = NOW() WHERE id = %s RETURNING id",
                (new_role, admin_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Admin not found")

    log_activity(admin["id"], "admin_role_changed", target_type="admin_user",
                 target_id=admin_id, details={"new_role": new_role}, ip=request.client.host)
    return {"message": f"Role updated to {new_role}"}


@router.get("/activity-log")
async def get_activity_log(limit: int = 50, admin: dict = Depends(require_super_admin)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT l.id, l.action, l.target_type, l.target_id, l.details,
                       l.ip_address, l.created_at,
                       a.email as admin_email, a.full_name as admin_name
                FROM admin_activity_log l
                LEFT JOIN admin_users a ON a.id = l.admin_id
                ORDER BY l.created_at DESC
                LIMIT %s
                """,
                (limit,)
            )
            cols = ['id', 'action', 'target_type', 'target_id', 'details',
                    'ip_address', 'created_at', 'admin_email', 'admin_name']
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            for r in rows:
                r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
            return rows