"""
routers/blogs.py — BharatMandir Blog API
=========================================
Place this file at:  backend/routers/blogs.py

Public endpoints:
  GET  /api/blogs          → list all published blogs (newest first)
  GET  /api/blogs/{id}     → single published blog

Admin endpoints (require Bearer JWT — same token used by Admin Panel):
  POST   /api/admin/blogs/{id}  → create blog
  PATCH  /api/admin/blogs/{id}  → update blog
  DELETE /api/admin/blogs/{id}  → delete blog
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.connection import get_db_cursor
from routers.admin_auth import get_current_admin   # reuse existing JWT auth

router = APIRouter(tags=["Blogs"])


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class BlogCreate(BaseModel):
    title:        str
    submitted_by: str
    description:  str
    is_published: bool = True

class BlogUpdate(BaseModel):
    title:        Optional[str] = None
    submitted_by: Optional[str] = None
    description:  Optional[str] = None
    is_published: Optional[bool] = None


# ── Public: List all published blogs ─────────────────────────────────────────

@router.get("/api/blogs")
def get_all_blogs():
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, uuid::text, title, submitted_by, description,
                   is_published, created_at, updated_at
            FROM   blogs
            WHERE  is_published = TRUE
            ORDER  BY created_at DESC
        """)
        rows = cur.fetchall()
    return [dict(r) for r in rows]


# ── Public: Get single blog by id ─────────────────────────────────────────────

@router.get("/api/blogs/{blog_id}")
def get_blog(blog_id: int):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, uuid::text, title, submitted_by, description,
                   is_published, created_at, updated_at
            FROM   blogs
            WHERE  id = %s AND is_published = TRUE
        """, (blog_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Blog not found")
    return dict(row)


# ── Admin: Create blog ────────────────────────────────────────────────────────

@router.post("/api/admin/blogs", status_code=201)
def create_blog(
    body: BlogCreate,
    admin: dict = Depends(get_current_admin),
):
    title        = body.title.strip()
    submitted_by = body.submitted_by.strip()
    description  = body.description.strip()

    if not title:
        raise HTTPException(400, "title must not be empty")
    if not submitted_by:
        raise HTTPException(400, "submitted_by must not be empty")
    if not description:
        raise HTTPException(400, "description must not be empty")

    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO blogs (title, submitted_by, description, is_published, created_by)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, uuid::text, title, submitted_by, description,
                      is_published, created_at, updated_at
        """, (title, submitted_by, description, body.is_published, admin["id"]))
        row = cur.fetchone()

    return {
        "success": True,
        "message": f"Blog '{title}' published successfully.",
        "blog":    dict(row),
    }


# ── Admin: Update blog ────────────────────────────────────────────────────────

@router.patch("/api/admin/blogs/{blog_id}")
def update_blog(
    blog_id: int,
    body: BlogUpdate,
    admin: dict = Depends(get_current_admin),
):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields provided to update")

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values     = list(updates.values()) + [blog_id]

    with get_db_cursor() as cur:
        cur.execute(f"""
            UPDATE blogs
            SET    {set_clause}
            WHERE  id = %s
            RETURNING id, uuid::text, title, submitted_by, description,
                      is_published, created_at, updated_at
        """, values)
        row = cur.fetchone()

    if not row:
        raise HTTPException(404, "Blog not found")

    return {"success": True, "blog": dict(row)}


# ── Admin: Delete blog ────────────────────────────────────────────────────────

@router.delete("/api/admin/blogs/{blog_id}", status_code=200)
def delete_blog(
    blog_id: int,
    admin: dict = Depends(get_current_admin),
):
    with get_db_cursor() as cur:
        cur.execute(
            "DELETE FROM blogs WHERE id = %s RETURNING id, title",
            (blog_id,)
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(404, "Blog not found")

    return {"success": True, "message": f"Blog '{row['title']}' deleted."}