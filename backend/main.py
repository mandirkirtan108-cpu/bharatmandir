"""
BharatMandir FastAPI Application
Entry point — run with: uvicorn main:app --reload
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import temples, route_planner, admin, festivals, spiritual_chat
from db.connection import get_pool, close_pool
import os
from dotenv import load_dotenv
from routers import proxy
from routers.admin_auth import router as admin_auth_router
from routers.panchang import router as panchang_router


load_dotenv()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 BharatMandir API starting...")
    try:
        get_pool()
        print("✅ Database pool ready")
    except Exception as e:
        print(f"⚠️  Could not connect to DB on startup: {e}")
        print("🔄  Will retry connection on first API request...")
    yield
    close_pool()
    print("🔒 Database pool closed")

app = FastAPI(
    title="BharatMandir API",
    description="Temple Discovery Platform — PostgreSQL + PostGIS Backend",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "https://bharatmandir.vercel.app",
]
_prod_origin = os.getenv("CORS_ORIGIN")
if _prod_origin and _prod_origin not in _origins:
    _origins.append(_prod_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── IMPORTANT: admin_auth_router PEHLE register karo ──────────────────────────
# admin_auth prefix = /api/admin/auth  (specific)
# admin prefix      = /api/admin       (broad)
# FastAPI routes top-to-bottom match karta hai.
# Agar admin.router pehle hota, toh /api/admin/auth/login ko
# admin router ka /api/admin/temples/{id} pattern intercept kar leta — 404!
# ──────────────────────────────────────────────────────────────────────────────
app.include_router(admin_auth_router)   # /api/admin/auth/*  — PEHLE
app.include_router(admin.router)        # /api/admin/*       — BAAD MEIN
app.include_router(temples.router)
app.include_router(route_planner.router)
app.include_router(festivals.router)
app.include_router(spiritual_chat.router)
app.include_router(panchang_router)     # /api/panchang/*
app.include_router(proxy.router)


@app.get("/")
def root():
    return {
        "project": "BharatMandir",
        "version": "1.0.0",
        "status":  "running",
        "docs":    "/api/docs",
    }

@app.get("/api/health")
def health_check():
    try:
        from db.connection import get_db_cursor
        with get_db_cursor() as cur:
            cur.execute("SELECT COUNT(*) as count FROM temples")
            result = cur.fetchone()
        return {
            "status":        "healthy",
            "database":      "connected",
            "total_temples": result["count"],
        }
    except Exception as e:
        return {
            "status":   "unhealthy",
            "database": "disconnected",
            "error":    str(e),
        }