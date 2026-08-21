"""Build the Welsh journal reader/search bundle from authoritative page Markdown."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "journals" / "dr"
MANIFEST = DATA_DIR / "journal.json"
OUTPUT = DATA_DIR / "journal-data.json"
ALLOWED_TRANSCRIPTION_STATUSES = {"untranscribed", "machine-draft", "needs-review", "reviewed"}
ALLOWED_TRANSLATION_STATUSES = {"untranslated", "machine-draft", "needs-review", "reviewed", "not-applicable"}
SECTION_KEYS = {
    "Welsh transcription": "welshTranscription",
    "Modern English translation": "translation",
    "Editorial annotations": "notes",
}


def parse_sections(path: Path) -> dict[str, str]:
    sections = {value: "" for value in SECTION_KEYS.values()}
    current = None
    collected = {value: [] for value in SECTION_KEYS.values()}
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            current = SECTION_KEYS.get(line[3:].strip())
            continue
        if current:
            collected[current].append(line)
    for key, lines in collected.items():
        sections[key] = "\n".join(lines).strip()
    return sections


def build_reader_data(journal: dict) -> list[dict]:
    if journal.get("pdfPageCount") != len(journal.get("pages", [])):
        raise SystemExit("Welsh journal manifest page count does not match its pages array")

    journal_pages = []
    for expected_number, page in enumerate(journal["pages"], start=1):
        expected_id = f"journal-dr-page-{expected_number:03d}"
        if page.get("pdfPageNumber") != expected_number or page.get("id") != expected_id:
            raise SystemExit(f"Welsh journal page sequence or stable ID mismatch at PDF page {expected_number}")
        if page.get("transcriptionStatus") not in ALLOWED_TRANSCRIPTION_STATUSES:
            raise SystemExit(f"Invalid transcription status for {expected_id}")
        if page.get("translationStatus") not in ALLOWED_TRANSLATION_STATUSES:
            raise SystemExit(f"Invalid translation status for {expected_id}")

        markdown_path = ROOT / page["transcriptionFile"]
        image_path = ROOT / page["image"]
        if not markdown_path.exists():
            raise SystemExit(f"Missing Welsh journal Markdown: {markdown_path}")
        if not image_path.exists():
            raise SystemExit(f"Missing Welsh journal page image: {image_path}")

        sections = parse_sections(markdown_path)
        display_page = page.get("manuscriptPageNumber") or f"PDF {expected_number}"
        journal_pages.append(
            {
                "id": page["id"],
                "journalId": journal["id"],
                "journalTitle": journal["title"],
                "title": f"{journal['title']} - Page {display_page}",
                "pageNumber": expected_number,
                "pdfPageNumber": expected_number,
                "manuscriptPageNumber": page.get("manuscriptPageNumber"),
                "image": page["image"],
                "transcriptionFile": page["transcriptionFile"],
                "transcriptionStatus": page["transcriptionStatus"],
                "translationStatus": page["translationStatus"],
                "section": page.get("section"),
                "sectionLabel": page.get("sectionLabel"),
                "sectionPriority": page.get("sectionPriority"),
                "pageLanguage": page.get("pageLanguage"),
                "sourceTranscriptionLabel": page.get("sourceTranscriptionLabel") or "Welsh transcription",
                "translationLabel": "Modern English translation",
                "searchLayer": page.get("searchLayer") or "Welsh transcription",
                "welshTranscription": sections["welshTranscription"],
                "translation": sections["translation"],
                "notes": sections["notes"],
                "notesLabel": "Editorial annotations",
                "contentContext": page.get("contentContext"),
                "contentAuthor": page.get("contentAuthor"),
                "scribe": page.get("scribe"),
                "translator": page.get("translator"),
                "editor": page.get("editor"),
                "attributionStatus": page.get("attributionStatus"),
                "attributionBasis": page.get("attributionBasis"),
                "people": page.get("people", []),
                "places": page.get("places", []),
                "dates": page.get("dates", []),
                "linkedEvents": page.get("linkedEvents", []),
                "editorialNotes": page.get("editorialNotes", []),
                "relatedJournalPassages": page.get("relatedJournalPassages", []),
            }
        )
    return journal_pages


def main() -> None:
    journal = json.loads(MANIFEST.read_text(encoding="utf-8"))
    pages = build_reader_data(journal)
    public_journal = {key: value for key, value in journal.items() if key != "pages"}
    OUTPUT.write_text(
        json.dumps({"journals": [public_journal], "journalPages": pages}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Built Welsh reader/search data for {len(pages)} journal pages")


if __name__ == "__main__":
    main()
