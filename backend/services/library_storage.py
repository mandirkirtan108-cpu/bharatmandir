"""
Storage helpers for the Sacred Books Library.

Uses the SAME Cloudinary account you already have configured
(services/cloudinary_service.py) — books just go to a different folder
and use resource_type="raw" instead of "image", since a PDF isn't an
image Cloudinary needs to transform.

If the library grows large enough that Cloudinary's raw-storage pricing
stops making sense, swap this module for an S3-backed one later — every
caller only depends on upload_book_pdf() / delete_book_pdf() /
upload_book_cover(), so the rest of the codebase doesn't need to change.
"""

from __future__ import annotations

import uuid
from typing import Optional

import cloudinary
import cloudinary.uploader

# Reuses the same cloudinary.config(...) call already made in
# services/cloudinary_service.py at import time — no separate config needed
# as long as this module is imported after cloudinary_service somewhere in
# the app (main.py already imports cloudinary_service on startup).


def upload_book_pdf(file_bytes: bytes, book_slug: str) -> dict:
    """
    Upload the original admin PDF to Cloudinary as a raw resource.

    Returns:
        {"url": <secure url>, "public_id": <cloudinary public id>, "bytes": <size>}
    """
    public_id = f"{book_slug}-{uuid.uuid4().hex[:8]}"

    result = cloudinary.uploader.upload(
        file_bytes,
        folder="bharatmandir/library/originals",
        public_id=public_id,
        resource_type="raw",
        overwrite=False,
        # Raw resources are private-by-default access on paid plans; on
        # free/basic plans they're reachable by URL if someone has it, so
        # treat the returned URL as "unlisted", not "public" — see
        # get_signed_pdf_url() below for admin-download flows that need
        # real access control.
    )

    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
        "bytes": result.get("bytes"),
    }


def delete_book_pdf(public_id: Optional[str]) -> None:
    """Delete a book's original PDF from Cloudinary. Safe no-op if empty."""
    if not public_id:
        return
    try:
        cloudinary.uploader.destroy(public_id, resource_type="raw")
    except Exception:
        # Never block a DB delete over a Cloudinary hiccup — same
        # philosophy as delete_file() in cloudinary_service.py.
        pass


def get_signed_pdf_url(public_id: str, expires_in: int = 3600) -> str:
    """
    Generate a short-lived signed URL for the original PDF (e.g. an
    admin "download original" button). Requires the Cloudinary account
    to have signed delivery / authenticated resource type enabled for
    true access control — until then, treat upload_book_pdf()'s url as
    unlisted-but-not-secret and avoid linking it from public pages.
    """
    from time import time

    url, _ = cloudinary.utils.cloudinary_url(
        public_id,
        resource_type="raw",
        type="authenticated",
        sign_url=True,
        expires_at=int(time()) + expires_in,
    )
    return url


def upload_book_cover(file_bytes: bytes, book_slug: str) -> dict:
    """
    Cover images go through the normal image pipeline (auto quality/format).

    NOTE: services.cloudinary_service.upload_file() hardcodes its folder to
    "bharatmandir/temples", so it can't be reused as-is for covers without
    misfiling them there. Uploading directly here instead, mirroring that
    function's logic but with the library's own folder.
    """
    public_id = f"{book_slug}-cover-{uuid.uuid4().hex[:8]}"

    result = cloudinary.uploader.upload(
        file_bytes,
        folder="bharatmandir/library/covers",
        public_id=public_id,
        resource_type="image",
        overwrite=False,
        transformation=[{"quality": "auto", "fetch_format": "auto"}],
    )

    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
        "width": result.get("width"),
        "height": result.get("height"),
    }