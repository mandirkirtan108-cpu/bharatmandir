"""Compatibility shim for older BharatMandir deployments.

The former library router depended on the hard-coded `_STATIC_BOOKS` registry
from `sacred_books.py`. The library is now database-backed and all public and
admin endpoints are registered by `routers.sacred_books.router`.

This alias keeps older `from routers import library` statements valid and
points them at the new database-backed router.
"""

from routers.sacred_books import router
