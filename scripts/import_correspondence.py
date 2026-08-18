#!/usr/bin/env python3
"""Import the supplied Roberts family correspondence compilation.

The source PDF is preserved unchanged. Its selectable typed text is copied as a
source layer; no OCR, modernization, or editorial correction is performed.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source" / "Letters between Wales and Robert D Roberts.pdf"
DATA_DIR = ROOT / "data" / "correspondence"
IMAGE_DIR = ROOT / "assets" / "correspondence"
EXPECTED_HASH = "90884f23395c2dd9cedb9dcea3b12400b8e65055d4521737b5c2b09accec475d"
EXPECTED_PAGES = 109
COLLECTION_ID = "correspondence-roberts-family-001"

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

ITEM_ROWS = [
    ([1], "Edward Roberts and John Lloyd", "D.R. Evans", "", ""),
    ([2, 3, 4, 5, 6], "William Ajax", "David Roberts", "", ""),
    ([7], "Unidentified correspondent", "Robert D. Roberts?", "", ""),
    ([8], "Robert D. Roberts", "Journal or record-book reader", "", ""),
    ([9, 10, 11, 12], "Unidentified correspondent", "John Roberts", "", ""),
    ([13, 14], "William Ajax?", "David Roberts", "", ""),
    ([15, 16], "William Ajax", "Robert D. Roberts", "", ""),
    ([17, 18], "Richard Thomas and Jane Thomas", "Catherine Roberts", "Creuau, Llanfrothen", ""),
    ([19], "Richard Thomas", "Catherine Roberts", "Creuau, Llanfrothen", ""),
    ([20, 21], "William Ajax", "Robert D. Roberts", "", ""),
    ([22, 23], "Edward Roberts", "Catherine Roberts", "", ""),
    ([24], "Edward E. Roberts", "Robert D. Roberts", "", ""),
    ([25], "Unidentified correspondent", "Robert D. Roberts", "", ""),
    ([26, 27], "Unidentified correspondent", "Unidentified recipient", "", ""),
    ([28, 29, 30], "Unidentified correspondent", "Robert D. Roberts and relatives", "", ""),
    ([31], "Richard Thomas", "Catherine Roberts", "Creuau, Llanfrothen", ""),
    ([32, 33], "Edward Roberts", "Robert D. Roberts", "", ""),
    ([34, 35], "Unidentified correspondent", "Robert D. Roberts", "", ""),
    ([36], "Rees Roberts", "Robert D. Roberts", "", ""),
    ([37], "Richard Thomas", "Catherine Roberts", "", ""),
    ([38, 39], "Robert D. Roberts", "Edward Roberts", "", ""),
    ([40, 41], "Rees Roberts", "Robert D. Roberts", "", ""),
    ([42, 43], "Robert W. Roberts", "Robert D. Roberts", "", ""),
    ([44], "Hugh Roberts and Mary Roberts", "Their children", "", ""),
    ([45, 46], "David Roberts", "Robert D. Roberts", "", ""),
    ([47], "Mary Jane Roberts", "Her aunt", "", ""),
    ([48], "Robert Roberts and Elisabeth Roberts", "Their parents", "", ""),
    ([49, 50], "Jane Humphreys and Edward Humphreys", "Their parents and grandparents", "", ""),
    ([51], "Robert Roberts and Elisabeth Roberts", "Their parents", "", ""),
    ([52], "Richard Thomas and Margaret Thomas", "Catherine Roberts and family", "Creuau, Llanfrothen", ""),
    ([52], "Edward Roberts", "Robert David Roberts", "", ""),
    ([53, 54], "Robert D. Roberts", "Edward Roberts and Richard Thomas", "", ""),
    ([55], "Catherine Roberts", "Richard Thomas and Margaret Thomas", "", "Creuau, Llanfrothen"),
    ([56], "Robert Roberts and Elisabeth Roberts", "Their sister", "", ""),
    ([57], "Robert Roberts and Elisabeth Roberts", "Their parents", "", ""),
    ([58], "Jane Humphreys and Edward Humphreys", "Their parents", "", ""),
    ([59], "Robert Roberts and Elisabeth Roberts", "Their parents", "", ""),
    ([60], "Robert W. Roberts", "Robert D. Roberts", "", ""),
    ([61], "Robert W. Roberts", "Robert D. Roberts", "", ""),
    ([62], "John W. Humphrey", "Robert D. Roberts", "", ""),
    ([63], "Robert D. Roberts", "Unnamed nephew", "", ""),
    ([64], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([65, 66], "Rees Roberts", "Robert D. Roberts", "", ""),
    ([67], "R.M. Parry", "Unnamed uncle", "", ""),
    ([68, 69], "Rees Roberts", "Robert D. Roberts", "", ""),
    ([70], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([71], "Robert D. Roberts", "Unnamed cousin", "", ""),
    ([72], "Robert D. Roberts", "Evan Roberts", "", ""),
    ([73], "David Roberts", "Robert D. Roberts", "", ""),
    ([74], "Rees Roberts", "Robert D. Roberts", "", ""),
    ([75], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([76, 77], "Robert Roberts", "Robert D. Roberts", "", ""),
    ([78], "Robert Roberts", "Robert D. Roberts", "", ""),
    ([79], "Robert Roberts", "Robert D. Roberts", "", ""),
    ([80], "Ellis Roberts", "Robert D. Roberts", "", ""),
    ([81], "E.W. Roberts", "Robert D. Roberts?", "", ""),
    ([81], "Agnes Roberts", "Mr. Jones", "West Rutland, Vermont", ""),
    ([82], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([83], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([84], "Evan W. Roberts and Laura", "Robert D. Roberts", "", ""),
    ([85, 87], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([86], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([88], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([89], "Ellis Roberts", "Robert D. Roberts", "", ""),
    ([90, 91], "Robert D. Roberts", "David D. Roberts?", "", ""),
    ([92], "Evan W. Roberts?", "Robert D. Roberts", "", ""),
    ([93], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([94], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([95, 96], "Evan W. Roberts and Laura", "Robert D. Roberts", "", ""),
    ([97], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([98], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([99], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([100], "Evan W. Roberts", "Robert D. Roberts", "", ""),
    ([101], "Ellis Roberts", "Robert D. Roberts", "", ""),
    ([102], "Robert D. Roberts?", "D.D. Roberts", "", ""),
    ([103], "E.W. Roberts", "Robert D. Roberts", "", ""),
    ([104], "E.W. Roberts", "Robert D. Roberts", "", ""),
    ([105], "M.G. Roberts", "Mr. Roberts", "", ""),
    ([106, 107, 108], "Robert D. Roberts", "Evan W. Roberts", "", ""),
    ([109], "Humphrey Jones (Bryfdir)", "Robert D. Roberts", "", ""),
]

DATE_OVERRIDES = {
    1: ("1856-11-03", "3 November 1856", "exact"),
    2: ("1856-10-27", "27 October 1856", "exact"),
    4: ("1857", "1857", "year-only"),
    7: ("1858", "1858", "year-only"),
    10: ("1859", "Easter 1859", "inferred"),
    14: ("1862", "c. 1862", "approximate"),
    18: ("1865-06-20", "20 June 1865?", "uncertain"),
    19: ("", "undated", "undated"),
    22: ("1867", "c. 1867", "inferred"),
    23: ("1867-01-02", "2 January 1867 or 1869", "uncertain"),
    31: ("", "undated", "undated"),
    34: ("1870-04", "April 1870", "month-only"),
    42: ("1885-04-29", "29 April 1885?", "uncertain"),
    46: ("1887-11-02", "2 November 1887?", "uncertain"),
    47: ("", "undated", "undated"),
    56: ("1903-11", "November 1903", "month-only"),
    61: ("1907-09-02", "2 September 1907", "exact"),
    65: ("1908-08-15", "15 August 1908?", "uncertain"),
    80: ("1917-07-27", "27 July 1917", "exact"),
}

ITEM_NOTES = {
    3: "Sender and recipient identification are uncertain in the supplied compilation.",
    4: "Compiled diary or record-book material included with the correspondence.",
    6: "Sender attribution is probable but not explicit on the surviving supplied pages.",
    10: "The supplied item begins after one or more missing preceding pages.",
    14: "Fragmentary supplied item; sender, recipient, and date are not established.",
    18: "Date reading is uncertain in the supplied text.",
    23: "The supplied date may read 1867 or 1869.",
    30: "First of two distinct correspondence items printed on PDF page 52.",
    31: "Second of two distinct correspondence items printed on PDF page 52.",
    42: "Date reading is uncertain in the supplied text.",
    46: "Date reading is uncertain in the supplied text.",
    47: "Undated scrap in the supplied compilation.",
    56: "First of two distinct correspondence items printed on PDF page 81.",
    57: "Second of two distinct correspondence items printed on PDF page 81.",
    61: "PDF pages 85 and 87 are duplicate or alternate supplied versions of the same letter; page 85 supplies the indexed text.",
    65: "Date reading is uncertain in the supplied text. The addressee is described as a son of David Roberts in Wales and is not automatically identified with David D. Roberts (The Judge), son of Robert D. Roberts.",
    75: "The addressee is described as a son of David Roberts in Wales and is not automatically identified with David D. Roberts (The Judge), son of Robert D. Roberts.",
}

PLACE_TERMS = [
    ("Gelli", "home-property"), ("Llanfrothen", "place"),
    ("Creuau", "home-property"), ("Ffestiniog", "place"),
    ("Glan-y-Pwll", "place"), ("Logan City", "place"),
    ("Salt Lake City", "place"), ("Box Elder", "place"),
    ("Harlech", "place"), ("Bangor", "place"),
    ("Pennsylvania", "place"), ("Seattle", "place"),
    ("Caernarfon", "place"), ("Llandudno", "place"),
    ("Pen-y-Cae", "place"), ("Monmouthshire", "place"),
    ("Dolgarregddu", "place"), ("Blaenau Ffestiniog", "place"),
    ("Rhiwbryfdir", "place"), ("Smithfield", "place"),
    ("Llanfairfechan", "place"), ("Penrhyndeudraeth", "place"),
    ("Middle Granville", "place"), ("East Bangor", "place"),
    ("Northampton County", "place"), ("West Rutland", "place"),
    ("Vermont", "place"), ("Hoosick Falls", "place"),
    ("New York", "place"), ("Utah", "place"),
    ("Wisconsin", "place"), ("California", "place"),
    ("Washington Territory", "place"), ("Salt Lake Valley", "place"),
    ("Great Salt Lake", "place"), ("Ramoth Cemetery", "place"),
    ("Rhosydd Quarry", "home-property"), ("Diffwys", "home-property"),
    ("Gloddfa Ganol", "home-property"), ("Lord Quarry", "home-property"),
    ("Rhiw Quarry", "home-property"), ("Erw Fawr", "home-property"),
    ("Gelli Park", "home-property"),
]

DATE_RE = [
    re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)[,\s]+((?:18|19)\d{2})\b", re.I),
    re.compile(r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+((?:18|19)\d{2})\b", re.I),
]


def slug(value: str) -> str:
    value = value.lower().replace("?", "")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "unknown"


def extract_date(text: str) -> tuple[str, str, str]:
    sample = "\n".join(text.splitlines()[:35])
    for index, pattern in enumerate(DATE_RE):
        match = pattern.search(sample)
        if not match:
            continue
        if index == 0:
            day, month_name, year = match.groups()
        else:
            month_name, day, year = match.groups()
        month = MONTHS[month_name.lower()]
        iso = f"{year}-{month:02d}-{int(day):02d}"
        display = f"{int(day)} {month_name.title()} {year}"
        return iso, display, "exact"
    year_match = re.search(r"\b(?:18|19)\d{2}\b", sample)
    if year_match:
        return year_match.group(0), year_match.group(0), "year-only"
    return "", "date not identified", "uncertain"


def split_people(label: str) -> list[str]:
    if any(word in label.lower() for word in (
        "unidentified", "unnamed", "their ", "journal or", "family", "relatives"
    )):
        return []
    cleaned = label.replace("?", "").strip()
    return [part.strip() for part in re.split(r"\s+and\s+", cleaned) if part.strip()]


def item_text(item_number: int, pages: list[int], page_text: list[str]) -> str:
    if item_number == 30:
        marker = "To: Robert David Roberts"
        if marker not in page_text[51]:
            raise RuntimeError("PDF page 52 second-item marker was not found")
        return page_text[51].split(marker, 1)[0].rstrip()
    if item_number == 31:
        marker = "To: Robert David Roberts"
        return marker + page_text[51].split(marker, 1)[1]
    if item_number == 56:
        marker = "West Rutland, Vermont"
        if marker not in page_text[80]:
            raise RuntimeError("PDF page 81 second-item marker was not found")
        return page_text[80].split(marker, 1)[0].rstrip()
    if item_number == 57:
        marker = "West Rutland, Vermont"
        return marker + page_text[80].split(marker, 1)[1]
    selected = [85] if item_number == 61 else pages
    return "\n\n".join(page_text[page - 1].strip() for page in selected).strip()


def make_occurrence(letter: dict, page_number: int, role: str = "mentioned") -> dict:
    return {
        "sourceType": "correspondence",
        "collectionId": COLLECTION_ID,
        "letterId": letter["id"],
        "pageId": f"correspondence-page-{page_number:03d}",
        "sourcePageId": f"correspondence-page-{page_number:03d}",
        "pageNumber": page_number,
        "role": role,
    }


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if source_hash != EXPECTED_HASH:
        raise RuntimeError(f"Source PDF hash changed: {source_hash}")

    with pdfplumber.open(SOURCE) as pdf:
        if len(pdf.pages) != EXPECTED_PAGES:
            raise RuntimeError(f"Expected {EXPECTED_PAGES} pages, found {len(pdf.pages)}")
        page_text = [(page.extract_text(x_tolerance=2, y_tolerance=3) or "").strip() for page in pdf.pages]

    pdf = pdfium.PdfDocument(str(SOURCE))
    if len(pdf) != EXPECTED_PAGES:
        raise RuntimeError("Renderer and text extractor disagree on page count")
    for page_number in range(1, EXPECTED_PAGES + 1):
        output = IMAGE_DIR / f"correspondence-page-{page_number:03d}.jpg"
        if not output.exists():
            image = pdf[page_number - 1].render(scale=1.55).to_pil().convert("RGB")
            image.save(output, "JPEG", quality=88, optimize=True)

    letters = []
    page_item_ids: dict[int, list[str]] = defaultdict(list)
    for item_number, row in enumerate(ITEM_ROWS, start=1):
        pages, sender, recipient, origin, destination = row
        text = item_text(item_number, pages, page_text)
        date, date_display, certainty = DATE_OVERRIDES.get(item_number, extract_date(text))
        letter_id = f"letter-{item_number:03d}"
        source_page_ids = [f"correspondence-page-{page:03d}" for page in pages]
        page_label = (
            f"PDF pages {pages[0]}-{pages[-1]}"
            if len(pages) > 1 and pages != [85, 87]
            else "PDF pages 85 and 87"
            if pages == [85, 87]
            else f"PDF page {pages[0]}"
        )
        letter = {
            "id": letter_id,
            "collectionId": COLLECTION_ID,
            "title": f"{sender} to {recipient} - {date_display}",
            "date": date,
            "dateDisplay": date_display,
            "dateCertainty": certainty,
            "sender": sender,
            "recipient": recipient,
            "senderDisplay": sender,
            "recipientDisplay": recipient,
            "senders": split_people(sender),
            "recipients": split_people(recipient),
            "origin": origin,
            "destination": destination,
            "pdfPages": pages,
            "sourcePageIds": source_page_ids,
            "pageLabel": page_label,
            "language": "English supplied translation/transcription; underlying letter language not established",
            "textType": "compiled-text",
            "textTypeLabel": "Supplied typed translation/transcription",
            "notes": ITEM_NOTES.get(item_number, ""),
            "people": [],
            "places": [],
            "placeNames": [],
            "relatedSources": [],
            "relatedJournalPassages": [],
            "relatedBookPages": [],
            "annotations": [],
            "suppliedText": text,
        }
        letters.append(letter)
        for page in pages:
            page_item_ids[page].append(letter_id)

    pages = []
    for page_number, text in enumerate(page_text, start=1):
        pages.append({
            "id": f"correspondence-page-{page_number:03d}",
            "collectionId": COLLECTION_ID,
            "pdfPageNumber": page_number,
            "label": f"PDF page {page_number}",
            "image": f"assets/correspondence/correspondence-page-{page_number:03d}.jpg",
            "sourcePdf": "source/Letters between Wales and Robert D Roberts.pdf",
            "suppliedText": text,
            "itemIds": page_item_ids[page_number],
            "annotations": [],
        })

    person_occurrences = defaultdict(list)
    person_display = {}
    place_occurrences = defaultdict(list)
    place_display = {}

    for letter in letters:
        first_page = letter["pdfPages"][0]
        for role in ("sender", "recipient"):
            for person in split_people(letter[role]):
                key = slug(person)
                person_display[key] = person
                occurrence = make_occurrence(letter, first_page, role)
                if occurrence not in person_occurrences[key]:
                    person_occurrences[key].append(occurrence)
                letter["people"].append(f"corr-person-{key}")

        text_lower = letter["suppliedText"].lower()
        for place, place_type in PLACE_TERMS:
            if place.lower() not in text_lower and place not in (letter["origin"], letter["destination"]):
                continue
            key = slug(place)
            place_display[key] = (place, place_type)
            for page_number in letter["pdfPages"]:
                if place.lower() in page_text[page_number - 1].lower() or place in (letter["origin"], letter["destination"]):
                    occurrence = make_occurrence(letter, page_number)
                    if occurrence not in place_occurrences[key]:
                        place_occurrences[key].append(occurrence)
            letter["places"].append(f"corr-place-{key}")
            if place not in letter["placeNames"]:
                letter["placeNames"].append(place)

    people = [{
        "id": f"corr-person-{key}",
        "name": person_display[key],
        "type": "person",
        "entryType": "person",
        "category": "people",
        "uncertain": False,
        "sourceOccurrences": occurrences,
    } for key, occurrences in sorted(person_occurrences.items())]

    for person in people:
        if person["id"] in {"corr-person-david-d-roberts", "corr-person-d-d-roberts"}:
            person["attributionStatus"] = "separate-correspondence-identity"
            person["identityNote"] = "This Welsh correspondent is described in the supplied text as a son of David Roberts and is not automatically identified with David D. Roberts (The Judge), son of Robert D. Roberts."
            person["notSameAs"] = ["person-david-d-roberts"]
    places = [{
        "id": f"corr-place-{key}",
        "name": place_display[key][0],
        "type": place_display[key][1],
        "entryType": place_display[key][1],
        "category": "homes-properties" if place_display[key][1] == "home-property" else "places",
        "uncertain": False,
        "sourceOccurrences": occurrences,
    } for key, occurrences in sorted(place_occurrences.items())]

    collection = {
        "id": COLLECTION_ID,
        "title": "Roberts Family Correspondence",
        "sectionTitle": "Letters & Correspondence",
        "description": "Family correspondence between members of the Roberts family and their relatives and friends in Wales, Utah, and elsewhere, spanning the nineteenth and early twentieth centuries.",
        "sourceFile": "source/Letters between Wales and Robert D Roberts.pdf",
        "sourceFileName": SOURCE.name,
        "sourceSha256": source_hash,
        "pdfPageCount": EXPECTED_PAGES,
        "itemCount": len(letters),
        "sourceLayerNote": "The supplied source is a typed compilation of already translated and transcribed letters. It is not uniformly a set of original manuscript scans. Supplied translator comments, bracketed explanations, question marks, and uncertain readings remain part of the source text; future project editorial annotations are stored separately.",
        "textLayer": "Supplied typed translation/transcription",
        "annotations": [],
    }

    (DATA_DIR / "collection.json").write_text(json.dumps(collection, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (DATA_DIR / "letters.json").write_text(json.dumps(letters, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (DATA_DIR / "page-text.json").write_text(json.dumps(pages, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (DATA_DIR / "entities.json").write_text(json.dumps({"people": people, "places": places}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    uncertain_count = sum(1 for item in letters if item["dateCertainty"] != "exact")
    if len(letters) != 80 or uncertain_count != 15:
        raise RuntimeError(f"Expected 80 items and 15 non-exact dates; found {len(letters)} and {uncertain_count}")
    print(f"Imported {EXPECTED_PAGES} pages, {len(letters)} correspondence items, {len(people)} people, and {len(places)} places.")


if __name__ == "__main__":
    main()
