"""
Cloudinary upload/delete helpers for BharatMandir.

Centralizes all Cloudinary config + upload/destroy logic so routers
(admin.py) don't talk to the SDK directly. Images/videos uploaded here
replace the old local-disk `/uploads` storage.
"""

from __future__ import annotations

import uuid
from typing import Optional, Literal

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
import os

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)

ResourceType = Literal["image", "video"]


def upload_file(
    file_bytes: bytes,
    filename: str,
    prefix: str = "",
    resource_type: ResourceType = "image",
) -> dict:
    """
    Upload bytes to Cloudinary under folder bharatmandir/temples.

    Returns {"url": <secure https CDN url>, "public_id": <cloudinary public id>}
    """
    public_id = f"{prefix}{uuid.uuid4().hex[:10]}"

    upload_kwargs = dict(
        folder="bharatmandir/temples",
        public_id=public_id,
        resource_type=resource_type,
        overwrite=False,
    )
    if resource_type == "image":
        upload_kwargs["transformation"] = [{"quality": "auto", "fetch_format": "auto"}]

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
    try:
        cloudinary.uploader.destroy(public_id, resource_type=resource_type)
    except Exception:
        # Never block a DB delete over a Cloudinary hiccup.
        pass