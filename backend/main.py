"""
BharatMandir FastAPI Application

Development command:
    uvicorn main:app --reload
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import (
    CORSMiddleware,
)
from fastapi.staticfiles import StaticFiles

from db.connection import (
    close_pool,
    get_db_cursor,
    get_pool,
)

from routers import (
    admin,
    festivals,
    proxy,
    route_planner,
    spiritual_chat,
    temples,
)

from routers.admin_auth import (
    router as admin_auth_router,
)
from routers.ai_festival_cache import (
    router as ai_festival_cache_router,
)
from routers.blogs import (
    router as blogs_router,
)
from routers.panchang import (
    router as panchang_router,
)
from routers.sacred_books import (
    ensure_library_schema,
    router as sacred_books_router,
)
from routers.user_auth import (
    router as user_auth_router,
)

# Volunteer portal routers
from routers.volunteer_auth import (
    router as volunteer_auth_router,
)
from routers.volunteer_submissions import (
    router as volunteer_submissions_router,
)
from routers.volunteer_automation import (
    router as volunteer_automation_router,
)

# Import karte hi Cloudinary configuration initialize hoti hai.
from services import cloudinary_service  # noqa: F401, E402


load_dotenv()


BASE_DIRECTORY = os.path.dirname(
    os.path.abspath(__file__)
)

UPLOAD_DIRECTORY = os.path.join(
    BASE_DIRECTORY,
    "uploads",
)

os.makedirs(
    UPLOAD_DIRECTORY,
    exist_ok=True,
)


@asynccontextmanager
async def lifespan(
    app: FastAPI,
):
    """
    Application startup aur shutdown lifecycle.
    """

    print(
        "BharatMandir API starting..."
    )

    try:
        get_pool()

        with get_db_cursor() as cursor:
            cursor.execute(
                """
                ALTER TABLE temple_submissions
                ADD COLUMN IF NOT EXISTS form_payload JSONB
                NOT NULL DEFAULT '{}'::jsonb
                """
            )
        ensure_library_schema()

        print(
            "Database connection pool ready."
        )
    except Exception as error:
        print(
            "Database startup connection failed:"
            f" {error}"
        )

        print(
            "Database connection will retry on "
            "the first API request."
        )

    yield

    close_pool()

    print(
        "Database connection pool closed."
    )


app = FastAPI(
    title="BharatMandir API",
    description=(
        "Temple Discovery Platform - "
        "PostgreSQL and PostGIS Backend"
    ),
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)


app.mount(
    "/uploads",
    StaticFiles(
        directory=UPLOAD_DIRECTORY
    ),
    name="uploads",
)


default_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "https://bharatmandir.vercel.app",
]


def get_allowed_origins() -> list[str]:
    """
    Default aur environment CORS origins combine karta hai.

    Multiple production origins environment variable mein
    comma-separated format mein add kiye ja sakte hain.
    """

    configured_origins = os.getenv(
        "CORS_ORIGIN",
        "",
    )

    origins = list(default_origins)

    if configured_origins:
        for origin in configured_origins.split(","):
            clean_origin = origin.strip()

            if (
                clean_origin
                and clean_origin not in origins
            ):
                origins.append(clean_origin)

    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Authentication routers
app.include_router(
    admin_auth_router
)

app.include_router(
    user_auth_router
)

app.include_router(
    volunteer_auth_router
)


# Admin and volunteer portal routers
app.include_router(
    admin.router
)

app.include_router(
    volunteer_submissions_router
)

app.include_router(
    volunteer_automation_router
)


# BharatMandir public feature routers
app.include_router(
    temples.router
)

app.include_router(
    route_planner.router
)

app.include_router(
    ai_festival_cache_router
)

app.include_router(
    festivals.router
)

app.include_router(
    spiritual_chat.router
)

app.include_router(
    panchang_router
)

app.include_router(
    proxy.router
)

app.include_router(
    sacred_books_router
)

app.include_router(
    blogs_router
)


@app.get("/")
def root():
    return {
        "project": "BharatMandir",
        "version": "1.0.0",
        "status": "running",
        "docs": "/api/docs",
        "portals": [
            "user",
            "admin",
            "volunteer",
        ],
    }


@app.get("/api/health")
def health_check():
    """
    API aur database connection health check.
    """

    try:
        from db.connection import (
            get_db_cursor,
        )

        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM temples
                """
            )

            temple_result = (
                cursor.fetchone()
            )

            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM volunteers
                """
            )

            volunteer_result = (
                cursor.fetchone()
            )

        return {
            "status": "healthy",
            "database": "connected",
            "total_temples": (
                temple_result["count"]
            ),
            "total_volunteers": (
                volunteer_result["count"]
            ),
        }

    except Exception as error:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(error),
        }