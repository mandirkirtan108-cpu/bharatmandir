"""
PDF extraction for the Sacred Books Library.

Requires: pip install pymupdf   (add "pymupdf" to backend/requirements.txt)

Extracts text page-by-page from a born-digital PDF (has a real text layer —
true for the Patanjali Yoga Sutras PDF used to test this, and for most
scripture PDFs). Falls back to flagging a page as "needs OCR" if it has a
visible content but near-zero extractable text (i.e. it's a scanned image).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

import fitz  # PyMuPDF


@dataclass
class ExtractedPage:
    page_number: int          # 1-indexed, matches what users see
    raw_text: str
    needs_ocr: bool = False


@dataclass
class ExtractionResult:
    pages: list[ExtractedPage] = field(default_factory=list)
    page_count: int = 0


# A page with real content but under this many extractable characters is
# almost certainly a scanned image with no text layer, not a genuinely
# short page — flag it instead of silently storing near-empty text.
_OCR_SUSPICION_THRESHOLD = 20


def extract_pdf_text(pdf_bytes: bytes) -> ExtractionResult:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: list[ExtractedPage] = []

    for index in range(len(doc)):
        page = doc[index]
        text = page.get_text("text") or ""
        text = text.strip()

        needs_ocr = len(text) < _OCR_SUSPICION_THRESHOLD and _page_has_visible_content(page)

        pages.append(
            ExtractedPage(
                page_number=index + 1,
                raw_text=text,
                needs_ocr=needs_ocr,
            )
        )

    result = ExtractionResult(pages=pages, page_count=len(doc))
    doc.close()
    return result


def _page_has_visible_content(page: "fitz.Page") -> bool:
    """A page is 'visibly non-blank' if it has images or drawn content —
    used to distinguish 'this page is genuinely blank' from 'this page
    is a scanned image with no text layer, needs OCR'."""
    try:
        return bool(page.get_images(full=True)) or bool(page.get_drawings())
    except Exception:
        return False


# ── Structuring raw text into renderable blocks ────────────────────────

_HEADING_PATTERN = re.compile(
    r"^(chapter|part|book|canto|sutra|adhyaya)\s+[\divxlcIVXLC]+", re.IGNORECASE
)
# Matches verse numbering like "1.1", "2.47", "Sutra 12" at line start —
# used to tag verse lines so the reader UI can style them distinctly from
# surrounding commentary, and so translation prompts can preserve numbering.
_VERSE_NUMBER_PATTERN = re.compile(r"^\s*(\d+[.\-]\d+|\d+\.)\s")


def structure_page_text(raw_text: str) -> list[dict]:
    """
    Turn a flat extracted-text blob into structured blocks:
        [{"type": "heading" | "verse" | "paragraph", "text": "..."}]

    This is intentionally simple pattern-matching, not a full layout
    parser — it's good enough to separate headings and numbered verses
    from body paragraphs for most scripture PDFs, and can be refined per
    book if a particular source needs different heuristics.
    """
    blocks: list[dict] = []

    # Collapse hyphenated line-break splits ("medi-\ntation" -> "meditation")
    # before splitting into paragraphs, so a mid-word line wrap doesn't
    # become two separate blocks.
    normalized = re.sub(r"-\n(?=[a-z])", "", raw_text)

    for raw_line in normalized.split("\n\n"):
        line = raw_line.strip()
        if not line:
            continue

        if _HEADING_PATTERN.match(line) and len(line) < 80:
            blocks.append({"type": "heading", "text": line})
        elif _VERSE_NUMBER_PATTERN.match(line):
            match = _VERSE_NUMBER_PATTERN.match(line)
            blocks.append(
                {
                    "type": "verse",
                    "number": match.group(1).rstrip("."),
                    "text": line[match.end():].strip(),
                }
            )
        else:
            blocks.append({"type": "paragraph", "text": line})

    return blocks