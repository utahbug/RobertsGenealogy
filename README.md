# RobertsGenealogy

This GitHub Pages application is an annotated digital edition of the Roberts family records. It separates original-source material from modern editorial interpretation and uses stable IDs in structured JSON data to drive relationships and navigation.

## Purpose of this scaffold

- Keep original material visible and untouched.
- Add layered editorial interpretation without silently replacing historical text.
- Use stable IDs and cross-links among events, book pages, journal pages, sources, people, places, and editorial notes.
- Keep content data separate from rendering logic.
- Preserve the real 68-page Book source while clearly identifying the remaining sample areas.

## Sections

- `Story`: chronological narrative, driven from `events` in data.
- `Charts`: relationship views generated from structured person relationships.
- `Book`: 68 source-page scans with stable page IDs and a separate searchable-text layer.
- `Journals`: first-class primary sources and per-page metadata.
- `Names and Places`: source-driven people/place/property index for Book pages 1-68.
- `Sources`: linked evidence records including census, wills, photographs, and more.
- `Search`: unified search across all object types.

## Current content state

- 1 event
- 68 real Book source pages
- Source-linked Names and Places index derived only from Book pages 1-68
- 1 journal
- 3 journal pages
- 2 evidence/source records
- 1 photograph
- 1 editorial correction note

Story, Journals, Sources, photographs, and the current chart framing retain `DEMO` or `SAMPLE` markers. Original Book scans, extracted searchable text, and Names and Places source forms are historical-source layers and are not labeled as invented demo facts.

## Directory structure

- `RobertsGenealogy/index.html`
- `RobertsGenealogy/styles.css`
- `RobertsGenealogy/app.js`
- `RobertsGenealogy/data/site-data.json`
- `RobertsGenealogy/data/book-text.json`
- `RobertsGenealogy/data/people.json`
- `RobertsGenealogy/data/places.json`
- `RobertsGenealogy/scripts/extract_book_text.py`
- `RobertsGenealogy/assets/book-pages/book-page-001.png` through `book-page-068.png`
- `RobertsGenealogy/assets/demo-images/*`

## Running locally

Serve the repository folder with a static web server. Direct `file://` loading is not supported because the application loads JSON data with `fetch`.

For example: `python -m http.server 8000`

## GitHub Pages deployment

A workflow publishes the repository root:

- `.github/workflows/gh-pages.yml`

The expected published URL is:

- https://utahbug.github.io/RobertsGenealogy/

This GitHub Pages deployment is intentionally private-review only and includes:

- `noindex`
- `nofollow`
- `noarchive`
- `noimageindex`

Both the page-level robots and googlebot directives are set in `index.html` so crawlers should not index or follow while content is in DEMO/review state.

After deployment, open that URL and verify:
- no horizontal scroll on normal content,
- sections are usable on narrow devices,
- zoom links on sample images are available.

## Data model and relationships

- `events` can reference:
  - `bookPages`, `journalPages`, `sources`, `editorialNotes`, `people`, `places`
- `journalPages` can reference:
  - `people`, `places`, `dates`, `linkedEvents`
- `sources` can reference:
  - `supports` event IDs and note IDs
- `editorialNotes` have a `type` field that must be one of:
  - `correction`
  - `translation_clarification`
  - `identification`
  - `additional_evidence`
  - `additional_context`
  - `unresolved_question`

## Adding and maintaining records

1. Add source-grounded people to `data/people.json` and places/properties to `data/places.json`.
2. Keep IDs stable and never hard-code links in HTML.
3. Link Book evidence with `sourcePages` values such as `book-page-009`.
4. Keep editorial interpretation in separate fields (`editorialNarrative`, `editorialNotes`).
5. Add local image files in `assets/` and reference them from JSON IDs.
6. Preserve `nameAsWritten` and add variants or editorial notes instead of silently changing source wording.

## Book searchable-text layer

`scripts/extract_book_text.py` reads the PDF's existing text layer for PDF pages 1-68 only and writes `data/book-text.json`. It does not run OCR, edit scans, or include page 69 and later. Run it with a Python environment containing `pypdf` whenever the source PDF text layer is intentionally refreshed.

The browser merges each `book-text.json` record into the matching `book-page-###` record at load time. Global Search therefore links matching text directly to the original source-page scan without treating extracted text as a corrected transcription.

## Mobile review notes

- Compact nav row with horizontal scrolling.
- Journal reader uses two-column layout with image and transcription side-by-side on wider displays.
- The reader stacks automatically on narrow screens.
- All sample pages/images are loaded from the data file and are touch-friendly with zoom affordances.
- Search results are card-style with larger tap targets.

## Notes

This is an initial scaffold for review before uploading or transcribing real Roberts material.
