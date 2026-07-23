from typing import Optional

from pydantic import BaseModel, Field


class BookCreateForm(BaseModel):
    """Fields sent alongside the file uploads on POST /api/admin/library/books.
    Received as Form(...) fields in the router, not as JSON body, since the
    request is multipart/form-data (it carries files)."""

    title: str
    subtitle: Optional[str] = None
    author: Optional[str] = None
    original_language: str = "en"
    description: Optional[str] = None
    category_id: Optional[int] = None


class BookUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    is_published: Optional[bool] = None


class TranslationTriggerRequest(BaseModel):
    languages: list[str] = Field(..., min_length=1, examples=[["hi", "sa"]])


class ReadingProgressUpdate(BaseModel):
    book_id: int
    language: str = "en"
    current_page: int
    total_pages: Optional[int] = None


class BookmarkCreate(BaseModel):
    book_id: int
    page_number: int
    label: Optional[str] = None


class HighlightCreate(BaseModel):
    book_id: int
    page_number: int
    text_snippet: str
    color: str = "yellow"
    note: Optional[str] = None


class PreferencesUpdate(BaseModel):
    theme: Optional[str] = None          # light | dark | sepia
    font_size: Optional[int] = None
    line_height: Optional[float] = None
    preferred_language: Optional[str] = None