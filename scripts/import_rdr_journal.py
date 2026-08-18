"""Import the unchanged Robert D. Roberts journal PDF into page-bound web assets."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source" / "RDR Journal.pdf"
DATA_DIR = ROOT / "data" / "journals" / "rdr"
PAGES_DIR = DATA_DIR / "pages"
IMAGE_DIR = ROOT / "assets" / "journals" / "rdr"
MANIFEST = DATA_DIR / "journal.json"
EXPECTED_PAGES = 119

SOURCE_TITLE = (
    "FAMILY RECORD AND TEMPLE RECORD #1 OF THE FAMILY OF DAVID AND CATHERINE "
    "UCH THOMAS AP RICHARD ROBERTS OF MERIONETHSHIRE, WALES THEIR ANCESTERS "
    "AND DESCENDANTS. ALSO RECORDING THE BEGINNING OF TEMPLE WORK IN THE FAMILY "
    "AND OTHER IMPORTANT MATTERS. WRITTEN AND COMPILED BY ROBERT D. ROBERTS OF LOGAN, UTAH."
)

INITIAL_TRANSCRIPTIONS = {
    1: """# journal-rdr-page-001

## English transcription

[unclear cover label:]

Ms
4
1726
Ea 2

## Editorial annotations

Front cover. No manuscript page number has been identified. The cover label requires visual review.
""",
    2: """# journal-rdr-page-002

## English transcription

Record of Robert D. Roberts

FAMILY RECORD AND TEMPLE RECORD #1
OF THE FAMILY OF DAVID AND CATHERINE
UCH THOMAS AP RICHARD ROBERTS OF
MERIONETHSHIRE, WALES THEIR ANCESTERS
AND DESCENDANTS. ALSO RECORDING THE
BEGINNING OF TEMPLE WORK IN THE
FAMILY AND OTHER IMPORTANT MATTERS.
WRITTEN AND COMPILED BY ROBERT D.
ROBERTS OF LOGAN, UTAH.

[unclear handwritten signature]
Ogden Utah
Aug 1948
Chairman

## Editorial annotations

Inside-cover source label. The typed label is legible; the later handwritten signature or attribution needs visual review and may be in another hand.
""",
    3: """# journal-rdr-page-003

## English transcription

Genealogy of David Robert Roberts
which he wrote January 6, 1854, in the Welsh language
and translated to the English by Robert David Roberts...

[Untranscribed: remaining handwritten text on this page.]

## Editorial annotations

Initial partial visual transcription only. This opening is an English translation/copy by Robert D. Roberts of material from David Roberts's Welsh record. Robert D. Roberts is not treated as the original author of the underlying Welsh material. The dense remaining handwriting requires line-by-line review against the scan.
""",
}


def placeholder(page_number: int) -> str:
    page_id = f"journal-rdr-page-{page_number:03d}"
    return f"""# {page_id}

## English transcription

[Untranscribed]

## Editorial annotations

This PDF page awaits line-by-line visual transcription.
"""


def rgb_image(image: Image.Image) -> Image.Image:
    if image.mode in {"RGBA", "LA"}:
        background = Image.new("RGB", image.size, "white")
        background.paste(image, mask=image.getchannel("A"))
        return background
    return image.convert("RGB")


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
        page_id = f"journal-rdr-page-{page_number:03d}"
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
            markdown_path.write_text(INITIAL_TRANSCRIPTIONS.get(page_number, placeholder(page_number)), encoding="utf-8")

        page = {
            "id": page_id,
            "pdfPageNumber": page_number,
            "manuscriptPageNumber": str(page_number) if 2 <= page_number <= 20 else None,
            "image": f"assets/journals/rdr/{page_id}.jpg",
            "transcriptionFile": f"data/journals/rdr/pages/{page_number:03d}.md",
            "transcriptionStatus": (
                "untranscribed"
                if "[Untranscribed]" in markdown_path.read_text(encoding="utf-8")
                else "needs-review"
            ),
            "hand": None,
            "contentAuthor": None,
            "contentAuthorId": None,
            "scribe": None,
            "scribeId": None,
            "editor": None,
            "editorId": None,
            "attributionStatus": "unassigned",
            "attributionBasis": "Page-level authorship has not yet been established from handwriting, date, signature, explicit statement, or contextual evidence; no attribution is inferred from PDF position.",
            "relatedJournalPassages": [],
        }
        if page_number == 3:
            page.update(
                {
                    "contentAuthor": "David Roberts (underlying Welsh material)",
                    "contentAuthorId": "person-david-roberts",
                    "scribe": "Robert D. Roberts",
                    "scribeId": "person-robert-david-roberts",
                    "translator": "Robert D. Roberts",
                    "translatorId": "person-robert-david-roberts",
                    "attributionStatus": "explicit",
                    "attributionBasis": "The page states that David Roberts wrote the material January 6, 1854, in Welsh and that Robert David Roberts translated it into English; the remaining page still needs full transcription review.",
                }
            )
            page["contentContext"] = (
                "English translation/copy by Robert D. Roberts of material from David Roberts's Welsh record. "
                "The original Welsh journal is preserved as a separate journal source."
            )
            page["searchLayer"] = "Historical English translation"
            page["relatedJournalPassages"] = [
                {
                    "journalId": "journal-dr-001",
                    "pageId": "journal-dr-page-068",
                    "relationship": "historical-translation-of",
                    "confidence": "probable",
                    "basis": "Both openings identify David Roberts and January 6, 1854; full passage alignment awaits transcription.",
                }
            ]
        pages.append(page)

    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    manifest = {
        "id": "journal-rdr-001",
        "title": "Robert D. Roberts Journal",
        "sourceTitle": SOURCE_TITLE,
        "primaryWriter": "Robert D. Roberts",
        "primaryWriterId": "person-robert-david-roberts",
        "continuator": "David D. Roberts",
        "continuatorId": "person-david-d-roberts",
        "continuationNote": "After Robert D. Roberts's death, this English record book was continued by his son David D. Roberts. The exact transition page has not been assigned solely from position and requires date, handwriting, signature, and contextual review.",
        "authorshipNote": (
            "The volume belonged primarily to and was written or compiled by Robert D. Roberts, then was continued after his death by his son David D. Roberts. "
            "Authorship is represented page by page; unreviewed pages remain unassigned rather than being attributed from their position."
        ),
        "contributors": [
            {"personId": "person-robert-david-roberts", "name": "Robert D. Roberts", "role": "primary writer and compiler"},
            {"personId": "person-david-d-roberts", "name": "David D. Roberts", "role": "later continuator after Robert D. Roberts's death"},
        ],
        "attributionModel": {
            "fields": ["contentAuthor", "scribe", "editor", "attributionStatus", "attributionBasis"],
            "statuses": ["explicit", "confirmed", "probable", "uncertain", "unassigned"],
            "transitionRule": "Do not assign the Robert D. Roberts to David D. Roberts transition solely from PDF position. Use dates, handwriting, signatures, explicit statements, known death chronology, and contextual evidence.",
            "historicalConstraint": "Material physically entered after Robert D. Roberts's death cannot be attributed to him as scribe.",
        },
        "language": "English",
        "dateRange": None,
        "repository": None,
        "description": (
            "English-language family record book containing an opening English translation/copy of material "
            "from David Roberts's Welsh record, followed by Robert D. Roberts's family history, journal, "
            "genealogical, temple, blessing, and related records."
        ),
        "openingContentNote": (
            "The opening portion is an English translation/copy by Robert D. Roberts of material from David Roberts's "
            "Welsh record. Robert D. Roberts is not treated as the original author of the underlying Welsh material."
        ),
        "sourceFile": "source/RDR Journal.pdf",
        "sourceFileSha256": source_hash,
        "pdfPageCount": EXPECTED_PAGES,
        "sourceTextLayer": "none",
        "relatedJournals": ["journal-dr-001"],
        "downloads": [
            {"label": "Editable Word transcription", "path": "exports/RDR-Journal-Transcription.docx"},
            {"label": "Plain Markdown transcription", "path": "exports/RDR-Journal-Transcription.md"},
        ],
        "transcriptionConvention": {
            "illegible": "[illegible]",
            "uncertainReading": "[word?] or [unclear: possible reading]",
            "multipleWords": "[illegible, approximately 4 words]",
            "partialWord": "Rob[erts?]",
        },
        "pages": pages,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    action = "Refreshed metadata for" if args.metadata_only else "Imported"
    print(f"{action} {EXPECTED_PAGES} PDF pages; source SHA-256 {source_hash}")


if __name__ == "__main__":
    main()
