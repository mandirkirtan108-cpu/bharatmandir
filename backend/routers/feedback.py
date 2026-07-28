"""
routers/feedback.py — BharatMandir Feedback API
=================================================
Place this file at:  backend/routers/feedback.py

Public endpoints:
  POST /api/feedback              → submit feedback (name/email optional, message required)

Admin endpoints (require Bearer JWT — same token used by Admin Panel):
  GET    /api/admin/feedback          → list all feedback (newest first, optional status filter)
  GET    /api/admin/feedback/{id}     → single feedback entry
  PATCH  /api/admin/feedback/{id}     → update status (new / reviewed / archived)
  DELETE /api/admin/feedback/{id}     → delete feedback entry
"""

import os
import sys
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.connection import get_db_cursor
from routers.admin_auth import get_current_admin  # reuse existing JWT auth

router = APIRouter(tags=["Feedback"])

VALID_STATUSES = ("new", "reviewed", "archived")


# ── Schema provisioning ────────────────────────────────────────────────────────

def ensure_feedback_schema() -> None:
    with get_db_cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id BIGSERIAL PRIMARY KEY,
                name TEXT,
                email TEXT,
                rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
                message TEXT NOT NULL,
                page_url TEXT,
                status TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'reviewed', 'archived')),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_feedback_created_at
            ON feedback (created_at DESC)
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_feedback_status
            ON feedback (status)
        """)


# ── Pydantic Schemas ────────────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    name:     Optional[str] = Field(None, max_length=120)
    email:    Optional[str] = Field(None, max_length=255)
    rating:   Optional[int] = Field(None, ge=1, le=5)
    message:  str = Field(..., min_length=1, max_length=4000)
    page_url: Optional[str] = Field(None, max_length=500)

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message must not be empty")
        return v.strip()


class FeedbackUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def status_valid(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v


# ── Public: Submit feedback ─────────────────────────────────────────────────────

@router.post("/api/feedback", status_code=201)
def submit_feedback(body: FeedbackCreate, request: Request):
    name    = (body.name or "").strip() or None
    email   = (body.email or "").strip() or None
    message = body.message.strip()
    page_url = (body.page_url or "").strip() or str(request.headers.get("referer") or "") or None

    if not message:
        raise HTTPException(400, "message must not be empty")

    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO feedback (name, email, rating, message, page_url, status)
            VALUES (%s, %s, %s, %s, %s, 'new')
            RETURNING id, name, email, rating, message, page_url, status,
                      created_at, updated_at
        """, (name, email, body.rating, message, page_url))
        row = cur.fetchone()

    return {
        "success":  True,
        "message":  "Thank you for your feedback!",
        "feedback": dict(row),
    }


# ── Admin: List all feedback ─────────────────────────────────────────────────────

@router.get("/api/admin/feedback")
def get_all_feedback(
    status: Optional[str] = None,
    admin: dict = Depends(get_current_admin),
):
    query = """
        SELECT id, name, email, rating, message, page_url, status,
               created_at, updated_at
        FROM   feedback
    """
    params: list = []

    if status and status != "all":
        if status not in VALID_STATUSES:
            raise HTTPException(400, f"status must be one of {VALID_STATUSES}")
        query += " WHERE status = %s"
        params.append(status)

    query += " ORDER BY created_at DESC"

    with get_db_cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

        cur.execute("""
            SELECT status, COUNT(*) AS count
            FROM   feedback
            GROUP  BY status
        """)
        count_rows = cur.fetchall()

    counts = {r["status"]: r["count"] for r in count_rows}
    counts["all"] = sum(counts.values())

    return {
        "feedback": [dict(r) for r in rows],
        "counts":   counts,
    }


# ── Admin: Get single feedback entry ─────────────────────────────────────────────

@router.get("/api/admin/feedback/{feedback_id}")
def get_feedback(
    feedback_id: int,
    admin: dict = Depends(get_current_admin),
):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, name, email, rating, message, page_url, status,
                   created_at, updated_at
            FROM   feedback
            WHERE  id = %s
        """, (feedback_id,))
        row = cur.fetchone()

    if not row:
        raise HTTPException(404, "Feedback not found")
    return dict(row)


# ── Admin: Update feedback status ─────────────────────────────────────────────────

@router.patch("/api/admin/feedback/{feedback_id}")
def update_feedback(
    feedback_id: int,
    body: FeedbackUpdate,
    admin: dict = Depends(get_current_admin),
):
    with get_db_cursor() as cur:
        cur.execute("""
            UPDATE feedback
            SET    status = %s, updated_at = NOW()
            WHERE  id = %s
            RETURNING id, name, email, rating, message, page_url, status,
                      created_at, updated_at
        """, (body.status, feedback_id))
        row = cur.fetchone()

    if not row:
        raise HTTPException(404, "Feedback not found")

    return {"success": True, "feedback": dict(row)}


# ── Admin: Delete feedback ───────────────────────────────────────────────────────

@router.delete("/api/admin/feedback/{feedback_id}", status_code=200)
def delete_feedback(
    feedback_id: int,
    admin: dict = Depends(get_current_admin),
):
    with get_db_cursor() as cur:
        cur.execute(
            "DELETE FROM feedback WHERE id = %s RETURNING id",
            (feedback_id,),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(404, "Feedback not found")

    return {"success": True, "message": f"Feedback #{row['id']} deleted."}