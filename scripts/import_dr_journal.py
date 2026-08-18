"""Import the unchanged Welsh DR journal PDF into page-bound web assets."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source" / "DR Journal.pdf"
DATA_DIR = ROOT / "data" / "journals" / "dr"
PAGES_DIR = DATA_DIR / "pages"
IMAGE_DIR = ROOT / "assets" / "journals" / "dr"
MANIFEST = DATA_DIR / "journal.json"
EXPECTED_PAGES = 110

SOURCE_TITLE = (
    "FAMILY HISTORY, WRITINGS AND POEMS of DAVID ROBERTS, NATIVE OF "
    "LLANFROTHEN, MEIRIONETHSHIRE, WALES"
)

INITIAL_PAGES = {
    67: """# journal-dr-page-067

## Welsh transcription

[Untranscribed: Welsh handwriting above the pasted title label.]

FAMILY HISTORY, WRITINGS AND POEMS
of
DAVID ROBERTS, NATIVE OF
LLANFROTHEN, MEIRIONETHSHIRE, WALES
He was the first
PRESIDENT OF THE FESTINIOG, WALES,
BRANCH OF THE CHURCH OF JESUS CHRIST
OF LATTER DAY SAINTS

D. R. Roberts
Ogden Utah
Chairman
Aug. 1948

## Modern English translation

[Not applicable: the transcribed pasted title label is already in English.]

## Editorial annotations

Initial visual transcription of the pasted English title label. The Welsh handwriting above it remains untranscribed. The identity and role of the person signing "D. R. Roberts" have not been resolved.
""",
    68: """# journal-dr-page-068

## Welsh transcription

Ionawr 6 1854        David Roberts
Fy Hanes

[Untranscribed: remaining Welsh handwriting on this page.]

## Modern English translation

January 6, 1854        David Roberts
My history

[Untranslated: remaining Welsh handwriting on this page.]

## Editorial annotations

Initial partial visual transcription and translation only. The date, name, and heading support a probable content relationship with Robert D. Roberts Journal PDF page 3, but no full page alignment is asserted until both passages are transcribed and compared.
""",
}


def placeholder(page_number: int) -> str:
    page_id = f"journal-dr-page-{page_number:03d}"
    return f"""# {page_id}

## Welsh transcription

[Untranscribed]

## Modern English translation

[Untranslated]

## Editorial annotations

This PDF page awaits line-by-line visual transcription and translation. No handwriting OCR has been treated as authoritative.
"""


def rgb_image(image: Image.Image) -> Image.Image:
    if image.mode in {"RGBA", "LA"}:
        background = Image.new("RGB", image.size, "white")
        background.paste(image, mask=image.getchannel("A"))
        return background
    return image.convert("RGB")


def section_for(page_number: int) -> tuple[str, str, str]:
    if page_number in {1, 110}:
        return ("physical-covers", "Physical cover", "preserved-source")
    if 2 <= page_number <= 62:
        return ("poetry-writings", "Poetry and other writings", "secondary")
    if 63 <= page_number <= 66:
        return ("poetry-inserts", "Inserted and printed poetry", "secondary")
    if page_number == 67:
        return ("family-history-title", "Family-history title leaf", "primary")
    return ("family-history-journal", "Family history and journal", "primary")


def page_language(page_number: int) -> str:
    if page_number in {1, 110}:
        return "No text established"
    if 63 <= page_number <= 66:
        return "English printed material"
    if page_number == 67:
        return "Welsh handwriting and English pasted label"
    return "Primarily Welsh; later additions may include English"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--metadata-only",
        action="store_true",
        help="Refresh the manifest and missing Markdown files without regenerating page images.",
    )
    args = parser.parse_args()

    if not SOURCE.exists():
        raise SystemExit(f"Missing source PDF: {SOURCE}")

    reader = PdfReader(SOURCE)
    if len(reader.pages) != EXPECTED_PAGES:
        raise SystemExit(f"Expected {EXPECTED_PAGES} PDF pages; found {len(reader.pages)}")

    PAGES_DIR.mkdir(parents=True, exist_ok=True)
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    pages = []
    for page_number, pdf_page in enumerate(reader.pages, start=1):
        page_id = f"journal-dr-page-{page_number:03d}"
        image_path = IMAGE_DIR / f"{page_id}.jpg"

        if args.metadata_only:
            if not image_path.exists():
                raise SystemExit(f"Missing derived journal image: {image_path}")
        else:
            images = list(pdf_page.images)
            if len(images) != 1:
                raise SystemExit(f"PDF page {page_number} contains {len(images)} images; expected exactly one")
            rgb_image(images[0].image).save(image_path, "JPEG", quality=90, optimize=True, progressive=True)

        markdown_path = PAGES_DIR / f"{page_number:03d}.md"
        if not markdown_path.exists():
            markdown_path.write_text(INITIAL_PAGES.get(page_number, placeholder(page_number)), encoding="utf-8")

        section_id, section_label, section_priority = section_for(page_number)
        page = {
            "id": page_id,
            "pdfPageNumber": page_number,
            "manuscriptPageNumber": "46" if page_number == 109 else None,
            "image": f"assets/journals/dr/{page_id}.jpg",
            "transcriptionFile": f"data/journals/dr/pages/{page_number:03d}.md",
            "transcriptionStatus": "needs-review" if page_number in {67, 68} else "untranscribed",
            "translationStatus": "not-applicable" if page_number in {1, 63, 64, 65, 66, 67, 110} else ("needs-review" if page_number == 68 else "untranslated"),
            "section": section_id,
            "sectionLabel": section_label,
            "sectionPriority": section_priority,
            "pageLanguage": page_language(page_number),
            "contentAuthor": None,
            "scribe": None,
            "translator": None,
            "editor": None,
            "attributionStatus": "uncertain",
            "attributionBasis": "No page-level hand or role attribution has yet been established by comparative review.",
            "people": [],
            "places": [],
            "dates": [],
            "relatedJournalPassages": [],
        }

        if page_number == 67:
            page.update(
                {
                    "sourceTranscriptionLabel": "Source transcription (English title label and Welsh handwriting)",
                    "editor": "D. R. Roberts (as written; identity unresolved)",
                    "attributionStatus": "uncertain",
                    "attributionBasis": "A pasted title label is signed D. R. Roberts and dated Aug. 1948; the signer's identity is unresolved.",
                    "contentContext": "Family-history title leaf. The pasted label identifies David Roberts and the Llanfrothen/Festiniog context; Welsh writing above the label is preserved separately from the English label.",
                }
            )
        elif page_number == 68:
            page.update(
                {
                    "contentAuthor": "David Roberts",
                    "scribe": "David Roberts",
                    "attributionStatus": "probable",
                    "attributionBasis": "The visible page heading reads Ionawr 6 1854 and David Roberts; handwriting comparison across the volume remains pending.",
                    "dates": ["1854-01-06"],
                    "contentContext": "Opening Welsh family-history page dated January 6, 1854. Only the heading has received an initial visual transcription and modern English translation.",
                    "relatedJournalPassages": [
                        {
                            "journalId": "journal-rdr-001",
                            "pageId": "journal-rdr-page-003",
                            "relationship": "historical-translation-in",
                            "confidence": "probable",
                            "basis": "Both openings identify David Roberts and January 6, 1854; full passage alignment awaits transcription.",
                        }
                    ],
                }
            )
        elif page_number == 109:
            page.update(
                {
                    "dates": ["1888", "1889"],
                    "attributionBasis": "Visible entries are dated 1888 and 1889, after David Roberts's death on November 4, 1858; the later contributor has not been identified.",
                }
            )

        pages.append(page)

    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    manifest = {
        "id": "journal-dr-001",
        "title": "David Roberts Welsh Journal",
        "sourceTitle": SOURCE_TITLE,
        "primaryWriter": "David Roberts and later Roberts family contributors",
        "creatorLabel": "Writers / contributors",
        "primaryWriterId": "person-david-roberts",
        "language": "Primarily Welsh, with later English additions and inserted printed material",
        "dateRange": None,
        "repository": None,
        "description": "One physically two-ended family volume containing Welsh poetry and other writings, a Welsh family-history and journal sequence, later family additions, and inserted printed material.",
        "sourceIdentityNote": "This is one physical source begun by David Roberts and later continued, copied, translated, annotated, or supplemented by Roberts family contributors. The site does not attribute the entire volume to one hand.",
        "physicalStructureNote": "Verified PDF structure: covers on pages 1 and 110; poetry/writings on pages 2-62; inserted/printed poetry on pages 63-66; family-history title leaf on page 67; family-history/journal sequence on pages 68-109.",
        "readerLayout": "welsh-english",
        "primarySection": "family-history-journal",
        "sourceFile": "source/DR Journal.pdf",
        "sourceFileSha256": source_hash,
        "pdfPageCount": EXPECTED_PAGES,
        "sourceTextLayer": "none",
        "relatedJournals": ["journal-rdr-001"],
        "downloads": [],
        "plannedExports": [
            "exports/David-Roberts-Welsh-Journal-Transcription.docx",
            "exports/David-Roberts-Welsh-Journal-English-Translation.docx",
            "exports/David-Roberts-Welsh-Journal-Welsh-English.docx",
            "exports/David-Roberts-Welsh-Journal-Welsh-English.pdf",
        ],
        "exportStatus": "Welsh transcription, modern English translation, bilingual Word, and combined PDF exports are defined for later generation from these same page Markdown files; they are not published as complete while nearly all pages remain untranscribed.",
        "transcriptionConvention": {
            "illegible": "[illegible]",
            "uncertainReading": "[word?] or [unclear: possible reading]",
            "multipleWords": "[illegible, approximately 4 words]",
            "partialWord": "Rob[erts?]",
        },
        "attributionModel": {
            "fields": ["contentAuthor", "scribe", "translator", "editor", "attributionStatus", "attributionBasis"],
            "statuses": ["confirmed", "probable", "uncertain"],
            "historicalConstraint": "David Roberts died November 4, 1858; post-death material is not attributed as newly written by him.",
        },
        "sections": [
            {"id": "physical-covers", "label": "Physical covers", "pdfPages": [1, 110], "priority": "preserved-source"},
            {"id": "poetry-writings", "label": "Poetry and other writings", "pdfPageStart": 2, "pdfPageEnd": 62, "priority": "secondary"},
            {"id": "poetry-inserts", "label": "Inserted and printed poetry", "pdfPageStart": 63, "pdfPageEnd": 66, "priority": "secondary"},
            {"id": "family-history-title", "label": "Family-history title leaf", "pdfPageStart": 67, "pdfPageEnd": 67, "priority": "primary"},
            {"id": "family-history-journal", "label": "Family history and journal", "pdfPageStart": 68, "pdfPageEnd": 109, "priority": "primary"},
        ],
        "pages": pages,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    action = "Refreshed metadata for" if args.metadata_only else "Imported"
    print(f"{action} {EXPECTED_PAGES} PDF pages; source SHA-256 {source_hash}")


if __name__ == "__main__":
    main()
