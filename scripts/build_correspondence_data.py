#!/usr/bin/env python3
"""Build the browser-ready Roberts Family Correspondence data bundle."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "correspondence"
OUTPUT = DATA_DIR / "correspondence-data.json"
EXPECTED_PAGES = 109
EXPECTED_ITEMS = 80


def read_json(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def main() -> None:
    collection = read_json("collection.json")
    letters = read_json("letters.json")
    pages = read_json("page-text.json")
    entities = read_json("entities.json")

    if collection["pdfPageCount"] != EXPECTED_PAGES:
        raise RuntimeError("Collection page count is not 109")
    if len(pages) != EXPECTED_PAGES or len(letters) != EXPECTED_ITEMS:
        raise RuntimeError("Correspondence page or item count is incomplete")

    letter_ids = {letter["id"] for letter in letters}
    page_ids = {page["id"] for page in pages}
    if len(letter_ids) != EXPECTED_ITEMS or len(page_ids) != EXPECTED_PAGES:
        raise RuntimeError("Correspondence stable IDs are not unique")

    for page in pages:
        image_path = ROOT / page["image"]
        if not image_path.exists():
            raise RuntimeError(f"Missing correspondence page image: {image_path}")
        if any(item_id not in letter_ids for item_id in page["itemIds"]):
            raise RuntimeError(f"Unknown item reference on {page['id']}")
        page["searchText"] = f"{page['id']} {page['label']} {page['suppliedText']}".lower()

    for letter in letters:
        if any(page_id not in page_ids for page_id in letter["sourcePageIds"]):
            raise RuntimeError(f"Unknown page reference on {letter['id']}")
        if not letter["relatedJournalPassages"] or True:
            pass
        letter["sortDate"] = letter["date"] or "9999-99-99"
        letter["searchText"] = " ".join([
            letter["id"], letter["title"], letter["sender"], letter["recipient"],
            letter["dateDisplay"], letter["origin"], letter["destination"],
            letter["pageLabel"], letter["suppliedText"],
        ]).lower()

    bundle = {
        "correspondenceCollections": [collection],
        "correspondencePages": pages,
        "letters": letters,
        "people": entities.get("people", []),
        "places": entities.get("places", []),
    }
    OUTPUT.write_text(json.dumps(bundle, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Built {OUTPUT.relative_to(ROOT)} with {len(pages)} pages and {len(letters)} items.")


if __name__ == "__main__":
    main()
