"""
Cloudinary upload/delete helpers for BharatMandir.

Centralizes all Cloudinary config + upload/destroy logic so routers
(admin.py) don't talk to the SDK directly. Images/videos uploaded here
replace the old local-disk `/uploads` storage.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Literal, Optional

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

# Load backend/.env reliably, even if app is started from another folder.
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_PATH)

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
    secure=True,
)

ResourceType = Literal["image", "video"]


def _ensure_configured() -> None:
    """Fail clearly if Cloudinary env vars are missing."""
    if not all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]):
        raise RuntimeError(
            "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env."
        )


def upload_file(
    file_bytes: bytes,
    filename: str,
    prefix: str = "",
    resource_type: ResourceType = "image",
) -> dict:
    """
    Upload bytes to Cloudinary under folder bharatmandir/temples.

    Returns:
        {
            "url": <secure https CDN url>,
            "public_id": <cloudinary public id>,
            "width": ...,
            "height": ...,
            "bytes": ...
        }
    """
    _ensure_configured()

    public_id = f"{prefix}{uuid.uuid4().hex[:10]}"

    upload_kwargs = {
        "folder": "bharatmandir/temples",
        "public_id": public_id,
        "resource_type": resource_type,
        "overwrite": False,
    }

    if resource_type == "image":
        upload_kwargs["transformation"] = [
            {"quality": "auto", "fetch_format": "auto"}
        ]

    result = cloudinary.uploader.upload(file_bytes, **upload_kwargs)

    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
        "width": result.get("width"),
        "height": result.get("height"),
        "bytes": result.get("bytes"),
    }


def delete_file(public_id: Optional[str], resource_type: ResourceType = "image") -> None:
    """Delete an asset from Cloudinary. Safe no-op if public_id is falsy."""
    if not public_id:
        return

    _ensure_configured()

    try:
        cloudinary.uploader.destroy(public_id, resource_type=resource_type)
    except Exception:
        # Never block a DB delete over a Cloudinary hiccup.
        pass