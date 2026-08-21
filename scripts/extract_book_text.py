"""Extract the existing searchable text layer from Roberts Book pages 1-68."""

import json
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source" / "DavidRoberts-Searchable.pdf"
OUTPUT = ROOT / "data" / "book-text.json"
FIRST_PAGE = 1
LAST_PAGE = 310


def main() -> None:
    reader = PdfReader(SOURCE)
    if len(reader.pages) < LAST_PAGE:
        raise RuntimeError(f"Expected at least {LAST_PAGE} PDF pages; found {len(reader.pages)}")

    pages = []
    for page_number in range(FIRST_PAGE, LAST_PAGE + 1):
        text = reader.pages[page_number - 1].extract_text() or ""
        pages.append(
            {
                "id": f"book-page-{page_number:03d}",
                "pageNumber": page_number,
                "sourceLayer": "Existing PDF searchable text (not a human transcription)",
                "ocrText": text,
            }
        )

    payload = {
        "bookId": "book-roberts-remembrance",
        "sourceFile": "source/DavidRoberts-Searchable.pdf",
        "firstPdfPage": FIRST_PAGE,
        "lastPdfPage": LAST_PAGE,
        "pageCount": len(pages),
        "extractionMethod": "Existing PDF text layer via pypdf; no new OCR",
        "pages": pages,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
