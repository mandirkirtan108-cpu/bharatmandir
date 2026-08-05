"""Cloudinary storage helpers for uploaded devotional audio."""

from __future__ import annotations

import uuid

import cloudinary.uploader

from services.cloudinary_service import _ensure_configured


def upload_audio(audio_bytes: bytes, filename: str, content_type: str | None, slug: str) -> tuple[str, str, str]:
    """Upload a bhajan, kirtan, chalisa, or other audio recording to Cloudinary.

    Cloudinary stores audio using its ``video`` resource type. The returned
    values are the public delivery URL, provider name, and Cloudinary public ID.
    """
    _ensure_configured()
    result = cloudinary.uploader.upload(
        audio_bytes,
        resource_type="video",
        folder="bharatmandir/library/audio",
        public_id=f"{slug}-{uuid.uuid4().hex[:12]}",
        overwrite=False,
    )
    return result["secure_url"], "cloudinary", result["public_id"]


def delete_audio(provider: str, storage_path: str | None) -> None:
    """Best-effort removal after an admin deletes an audio recording."""
    if provider != "cloudinary" or not storage_path:
        return
    try:
        _ensure_configured()
        cloudinary.uploader.destroy(storage_path, resource_type="video")
    except Exception as exc:
        # The database record can still be removed if Cloudinary is briefly
        # unavailable; this prevents an external issue from blocking an admin.
        print(f"[library-audio] Could not remove stored audio: {exc}")
