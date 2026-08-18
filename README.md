# RobertsGenealogy (DEMO scaffold)

This scaffold is a GitHub Pages-ready annotated genealogy application. It separates original-source material from modern editorial interpretation and uses structured JSON data to drive all relationships.

## Purpose of this scaffold

- Keep original material visible and untouched.
- Add layered editorial interpretation without silently replacing historical text.
- Use stable IDs and cross-links among events, book pages, journal pages, sources, people, places, and editorial notes.
- Keep content data separate from rendering logic.
- Start with searchable architecture and sample records only.

## Sections

- `Story`: chronological narrative, driven from `events` in data.
- `Book`: pages from the original book with IDs and image placeholders.
- `Journals`: first-class primary sources and per-page metadata.
- `Sources`: linked evidence records including census, wills, photographs, and more.
- `Search`: unified search across all object types.

## Current sample counts

- 1 event
- 2 book pages
- 1 journal
- 3 journal pages
- 2 evidence/source records
- 1 photograph
- 1 editorial correction note

All sample content includes `DEMO` or `SAMPLE` markers.

## Directory structure

- `RobertsGenealogy/index.html`
- `RobertsGenealogy/styles.css`
- `RobertsGenealogy/app.js`
- `RobertsGenealogy/data/site-data.json`
- `RobertsGenealogy/assets/demo-images/*`

## Running locally

Open `RobertsGenealogy/index.html` directly in a browser, or serve the folder with any static server.

## GitHub Pages deployment

A workflow publishes this demo from the `RobertsGenealogy/` folder:

- `.github/workflows/gh-pages.yml`

The expected published URL is:

- https://utahbug.github.io/RobertsGenealogy/

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

## Adding real records

1. Replace demo entries in `data/site-data.json` with real records.
2. Keep IDs stable and never hard-code links in HTML.
3. Keep source text in dedicated fields (`originalSourceText`, `ocrText`, `transcription`, etc.).
4. Keep editorial interpretation in separate fields (`editorialNarrative`, `editorialNotes`).
5. Add local image files in `assets/` and reference them from JSON IDs.

## Mobile review notes

- Compact nav row with horizontal scrolling.
- Journal reader uses two-column layout with image and transcription side-by-side on wider displays.
- The reader stacks automatically on narrow screens.
- All sample pages/images are loaded from the data file and are touch-friendly with zoom affordances.
- Search results are card-style with larger tap targets.

## Notes

This is an initial scaffold for review before uploading or transcribing real Roberts material.
