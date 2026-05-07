"""
Image Proxy Router for BharatMandir.
Uses Wikimedia REST API to bypass hotlink/403 blocking.

Add to main.py:
    from routers import proxy
    app.include_router(proxy.router)
"""

import httpx
import re
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
import hashlib, os, pathlib
from urllib.parse import urlparse

router = APIRouter(prefix="/api/proxy", tags=["Proxy"])

CACHE_DIR = pathlib.Path(
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "img_cache")
)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_DOMAINS = {
    "upload.wikimedia.org",
    "commons.wikimedia.org",
    "en.wikipedia.org",
    "i.ibb.co",
    "res.cloudinary.com",
    "lh3.googleusercontent.com",
    "images.unsplash.com",
}

# Wikipedia requires this exact User-Agent format or returns 403
WIKI_UA = "BharatMandir/1.0 (https://bharatmandir.in; contact@bharatmandir.in) python-httpx/0.27"


def _cache_path(url: str) -> pathlib.Path:
    key = hashlib.md5(url.encode()).hexdigest()
    return CACHE_DIR / key


def extract_wiki_filename(url: str) -> tuple[str, str] | None:
    """
    Extract filename and width from a Wikimedia thumb URL.
    
    Input:  https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Annapurna_temple.jpg/800px-Annapurna_temple.jpg
    Output: ('Annapurna_temple.jpg', '800')
    """
    pattern = r'upload\.wikimedia\.org/wikipedia/(?:commons|en)/thumb/[a-f0-9]/[a-f0-9]+/(.+?)/(\d+)px-.+'
    match = re.search(pattern, url)
    if match:
        return match.group(1), match.group(2)
    return None


async def fetch_via_wikimedia_api(filename: str, width: str) -> tuple[bytes, str] | None:
    """
    Two-step fetch using Wikipedia's official API:
    1. Call API to get actual resized image URL
    2. Fetch that image

    Wikipedia's API accepts our User-Agent; direct image URLs don't.
    """
    api_url = (
        f"https://en.wikipedia.org/w/api.php"
        f"?action=query"
        f"&titles=File:{filename}"
        f"&prop=imageinfo"
        f"&iiprop=url"
        f"&iiurlwidth={width}"
        f"&format=json"
    )

    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        # Step 1: get actual image URL from API
        api_resp = await client.get(api_url, headers={
            "User-Agent": WIKI_UA,
            "Accept": "application/json",
        })
        if api_resp.status_code != 200:
            return None

        data = api_resp.json()
        pages = data.get("query", {}).get("pages", {})
        img_url = None
        for page in pages.values():
            info = page.get("imageinfo", [])
            if info:
                img_url = info[0].get("thumburl") or info[0].get("url")
                break

        if not img_url:
            return None

        # Step 2: fetch the resolved image URL
        img_resp = await client.get(img_url, headers={
            "User-Agent": WIKI_UA,
            "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
            "Referer": "https://en.wikipedia.org/",
        })
        if img_resp.status_code != 200:
            return None

        ct = img_resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        return img_resp.content, ct


@router.get("/image")
async def proxy_image(url: str = Query(..., description="External image URL to proxy")):
    """
    Proxy external images server-side.
    For Wikipedia URLs, uses the official Wikimedia API (avoids 403).

    GET /api/proxy/image?url=https://upload.wikimedia.org/...
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "Only http/https URLs allowed")

    domain = parsed.netloc.lower()
    is_wikimedia = "wikimedia.org" in domain or "wikipedia.org" in domain

    if not is_wikimedia and not any(
        domain == d or domain.endswith("." + d) for d in ALLOWED_DOMAINS
    ):
        raise HTTPException(403, f"Domain '{domain}' not in proxy whitelist")

    # ── Cache hit ──────────────────────────────────────────────────────────
    cache_file = _cache_path(url)
    if cache_file.exists() and cache_file.stat().st_size > 500:
        data = cache_file.read_bytes()
        ext = url.split(".")[-1].split("?")[0].lower()
        ct_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
                  "webp": "image/webp", "gif": "image/gif"}
        ct = ct_map.get(ext, "image/jpeg")
        return Response(content=data, media_type=ct, headers={
            "Cache-Control": "public, max-age=604800",
            "X-Cache": "HIT",
        })

    # ── Wikimedia: use official 2-step API fetch ───────────────────────────
    if is_wikimedia:
        wiki_info = extract_wiki_filename(url)
        if not wiki_info:
            raise HTTPException(400, "Could not parse Wikimedia URL")

        filename, width = wiki_info
        try:
            result = await fetch_via_wikimedia_api(filename, width)
        except Exception as e:
            raise HTTPException(502, f"Wikimedia API error: {e}")

        if not result:
            raise HTTPException(404, f"Wikimedia API returned no image for: {filename}")

        data, content_type = result
        try:
            cache_file.write_bytes(data)
        except Exception:
            pass

        return Response(content=data, media_type=content_type, headers={
            "Cache-Control": "public, max-age=604800",
            "X-Cache": "MISS",
        })

    # ── Other allowed domains: direct fetch ───────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": WIKI_UA,
                "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
            })
    except httpx.TimeoutException:
        raise HTTPException(504, "Upstream image server timed out")
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch image: {e}")

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Upstream returned {resp.status_code}")

    ct = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
    if not ct.startswith("image/"):
        raise HTTPException(422, "URL did not return an image")

    data = resp.content
    try:
        cache_file.write_bytes(data)
    except Exception:
        pass

    return Response(content=data, media_type=ct, headers={
        "Cache-Control": "public, max-age=604800",
        "X-Cache": "MISS",
    })