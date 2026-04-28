"""
BharatMandir FastAPI Application
Entry point — run with: uvicorn main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import temples
from routers import route_planner
from db.connection import get_pool, close_pool
import os
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# App initialization
# ─────────────────────────────────────────────

app = FastAPI(
    title="BharatMandir API",
    description="Temple Discovery Platform — PostgreSQL + PostGIS Backend",
    version="1.0.0",
    docs_url="/api/docs",       # Swagger UI
    redoc_url="/api/redoc"      # ReDoc UI
)


# ─────────────────────────────────────────────
# CORS — Allow React frontend to call this API
# ─────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",    # React dev server
        "http://localhost:5173",    # Vite dev server
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Startup / Shutdown Events
# ─────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Initialize DB connection pool when app starts."""
    print("🚀 BharatMandir API starting...")
    get_pool()
    print("✅ Database pool ready")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up DB connections when app stops."""
    close_pool()
    print("🔒 Database pool closed")


# ─────────────────────────────────────────────
# Register Routers
# ─────────────────────────────────────────────

app.include_router(temples.router)
app.include_router(route_planner.router)


# ─────────────────────────────────────────────
# Root & Health Check Endpoints
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "project": "BharatMandir",
        "version": "1.0.0",
        "status":  "running",
        "docs":    "/api/docs"
    }


@app.get("/api/health")
def health_check():
    """
    Health check endpoint.
    Your React app can ping this to verify backend is alive.
    """
    try:
        from db.connection import get_db_cursor
        with get_db_cursor() as cur:
            cur.execute("SELECT COUNT(*) as count FROM temples")
            result = cur.fetchone()
        return {
            "status":        "healthy",
            "database":      "connected",
            "total_temples": result['count']
        }
    except Exception as e:
        return {
            "status":   "unhealthy",
            "database": "disconnected",
            "error":    str(e)
        }