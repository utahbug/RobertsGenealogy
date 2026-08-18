# RobertsGenealogy

This GitHub Pages application is an annotated digital edition of the Roberts family records. It separates original-source material from modern editorial interpretation and uses stable IDs in structured JSON data to drive relationships and navigation.

## Purpose of this scaffold

- Keep original material visible and untouched.
- Add layered editorial interpretation without silently replacing historical text.
- Use stable IDs and cross-links among events, book pages, journal pages, sources, people, places, and editorial notes.
- Keep content data separate from rendering logic.
- Preserve the real 68-page Book, 119-page Robert D. Roberts journal, and 110-page Welsh DR journal sources while clearly identifying the remaining sample areas.

## Sections

- `Story`: chronological narrative, driven from `events` in data.
- `Charts`: relationship views generated from structured person relationships.
- `Book`: 68 source-page scans with stable page IDs and a separate searchable-text layer.
- `Journals`: two independent real sources: the 119-page English Robert D. Roberts Journal and the 110-page primarily Welsh David Roberts Journal, each with scan/text layers and stable PDF-page IDs.
- `Names and Places`: source-driven people/place/property index for Book pages 1-68.
- `Sources`: linked evidence records including census, wills, photographs, and more.
- `Search`: unified search across all object types.

## Current content state

- 1 event
- 68 real Book source pages
- Source-linked Names and Places index derived only from Book pages 1-68
- 2 real journals
- 229 journal page scans and editable page-level transcription files
- 2 evidence/source records
- 1 photograph
- 1 editorial correction note

Story, Sources, photographs, and the current chart framing retain `DEMO` or `SAMPLE` markers. Original Book scans, the Robert D. Roberts journal, extracted searchable text, and Names and Places source forms are historical-source layers and are not labeled as invented demo facts.

## Directory structure

- `RobertsGenealogy/index.html`
- `RobertsGenealogy/styles.css`
- `RobertsGenealogy/app.js`
- `RobertsGenealogy/data/site-data.json`
- `RobertsGenealogy/data/book-text.json`
- `RobertsGenealogy/data/people.json`
- `RobertsGenealogy/data/places.json`
- `RobertsGenealogy/data/journals/rdr/journal.json`
- `RobertsGenealogy/data/journals/rdr/journal-data.json` (generated reader/search bundle)
- `RobertsGenealogy/data/journals/rdr/pages/001.md` through `119.md`
- `RobertsGenealogy/data/journals/dr/journal.json`
- `RobertsGenealogy/data/journals/dr/journal-data.json` (generated reader/search bundle)
- `RobertsGenealogy/data/journals/dr/pages/001.md` through `110.md`
- `RobertsGenealogy/exports/RDR-Journal-Transcription.docx`
- `RobertsGenealogy/exports/RDR-Journal-Transcription.md`
- `RobertsGenealogy/scripts/extract_book_text.py`
- `RobertsGenealogy/scripts/import_rdr_journal.py`
- `RobertsGenealogy/scripts/import_dr_journal.py`
- `RobertsGenealogy/scripts/build_dr_journal_data.py`
- `RobertsGenealogy/scripts/build_journal_data.py`
- `RobertsGenealogy/assets/book-pages/book-page-001.png` through `book-page-068.png`
- `RobertsGenealogy/assets/journals/rdr/journal-rdr-page-001.jpg` through `journal-rdr-page-119.jpg`
- `RobertsGenealogy/assets/journals/dr/journal-dr-page-001.jpg` through `journal-dr-page-110.jpg`
- `RobertsGenealogy/source/RDR Journal.pdf` (unchanged original source)
- `RobertsGenealogy/source/DR Journal.pdf` (unchanged original source)
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

## Robert D. Roberts journal transcription

`source/RDR Journal.pdf` is an image-only, 119-page original source. It remains unchanged. Stable IDs use the PDF sequence (`journal-rdr-page-001` through `journal-rdr-page-119`); handwritten manuscript numbers are separate optional metadata and never replace PDF page numbers.

Human-editable transcription files live in `data/journals/rdr/pages/`. RDR Journal is an English-language source, so each page keeps separate sections for English transcription and editorial annotations. It is not classified as bilingual merely because its opening copies/translates material from an earlier Welsh record. Use the consistent uncertainty forms `[illegible]`, `[word?]`, `[unclear: possible reading]`, `[illegible, approximately N words]`, and partial words such as `Rob[erts?]`.

Run `python scripts/build_journal_data.py` after editing Markdown. It regenerates `data/journals/rdr/journal-data.json`, `exports/RDR-Journal-Transcription.docx`, and `exports/RDR-Journal-Transcription.md` from the same page sources, preventing website/download drift. The GitHub Pages workflow runs this build automatically before deployment.

`python scripts/import_rdr_journal.py` is the reproducible initial-import utility. It verifies the 119-page PDF, records its SHA-256 checksum, creates web JPEG derivatives, and creates only missing transcription files so later human edits are not overwritten. It requires `pypdf` and Pillow.

Current transcription state: PDF pages 1-3 contain initial visual drafts marked `needs-review`; pages 4-119 are explicit editable `[Untranscribed]` records. PDF/manuscript page correspondences supplied so far are 2/2, 3/3, and 4/4. No handwriting OCR was treated as authoritative, and no page is marked `reviewed` yet.

## David Roberts Welsh journal

`source/DR Journal.pdf` is a separate, unchanged, image-only 110-page source. It is one physically two-ended volume, not a continuation of `RDR Journal.pdf`: PDF pages 2-62 contain poetry and other writings, pages 63-66 preserve inserted/printed poetry, page 67 is the family-history title leaf, and pages 68-109 contain the family-history/journal sequence. Covers remain available as PDF pages 1 and 110.

Editable page files live in `data/journals/dr/pages/` and keep three explicit sections: Welsh transcription, modern English translation, and editorial annotations. `scripts/build_dr_journal_data.py` regenerates the site reader/search bundle from those files. Page metadata separately records `contentAuthor`, `scribe`, `translator`, `editor`, `attributionStatus`, and `attributionBasis`; ambiguous hands are not merged or silently attributed to David Roberts.

The site uses one conservative initial cross-link between Welsh PDF page 68 and RDR PDF page 3 because both visible openings identify David Roberts and January 6, 1854. It is marked probable and does not assert that the full pages align. All later correspondence must be added only after both passages are transcribed and compared.

Planned Welsh-source exports are `David-Roberts-Welsh-Journal-Transcription.docx`, `David-Roberts-Welsh-Journal-English-Translation.docx`, `David-Roberts-Welsh-Journal-Welsh-English.docx`, and `David-Roberts-Welsh-Journal-Welsh-English.pdf`. They will be generated from the same Markdown sources after sufficient reviewed transcription exists; incomplete placeholder documents are not published as finished transcriptions.

## Authorship and editorial provenance

The project keeps a structured historical authorship chain in
`data/provenance.json`. The canonical `person-david-d-roberts` record represents
David D. Roberts, also known in family context as **The Judge**. The Book-derived
wording **David R. Roberts** remains preserved as `nameAsWritten` and as a
variant rather than being silently discarded.

The original Book of Remembrance is identified as David D. Roberts's historical
compilation. Its statements remain the original compilation layer. Modern
corrections, improved Welsh translations, identifications, and additional
evidence belong to a separate editorial layer with an original statement, modern
finding, reason, and supporting sources.

The Robert D. Roberts English journal supports page-level `contentAuthor`,
`scribe`, `editor`, `attributionStatus`, and `attributionBasis`. The volume
was primarily written or compiled by Robert D. Roberts and was continued after
his death by his son David D. Roberts. No transition page is inferred from PDF
position alone. Unreviewed pages remain `unassigned`; page 3 records only the
authorship and translation roles explicitly stated on that page.

Correspondence people named David D. or D.D. Roberts are not merged by name
alone. The two Welsh addressees described as sons of David Roberts carry
`notSameAs: person-david-d-roberts` safeguards because The Judge was the son of
Robert D. Roberts.

## Roberts Family Correspondence

The Sources area includes the supplied 109-page typed compilation
`source/Letters between Wales and Robert D Roberts.pdf` as **Roberts Family
Correspondence**. It is described as a supplied typed translation/transcription,
not as a uniform set of original manuscript scans.

Correspondence content is stored in `data/correspondence/`:

- `collection.json`: collection identity, source hash, preservation note, and counts.
- `letters.json`: 80 identifiable item records with stable `letter-NNN` IDs.
- `page-text.json`: exact PDF-page boundaries, stable
  `correspondence-page-NNN` IDs, supplied selectable text, and item links.
- `entities.json`: provenance-preserving people and place occurrences for Names
  and Places.
- `correspondence-data.json`: generated browser bundle consumed by the site.

A multi-page letter has one record whose `pdfPages` and `sourcePageIds` arrays
contain every supplied page. PDF pages 52 and 81 each link to two separately
identified items. PDF pages 85 and 87 are retained as supplied but link to one
record because they are duplicate/alternate versions of the same item.

Run `python scripts/import_correspondence.py` only when intentionally rebuilding
from the unchanged source PDF. It extracts the existing selectable text without
OCR and renders readable page images. Run
`python scripts/build_correspondence_data.py` after editing correspondence JSON;
the GitHub Pages workflow runs this second command automatically.

Supplied translator notes, brackets, question marks, and uncertain readings remain
in the source text. Project annotations and cross-links remain separate and empty
until supported by research.

## Mobile review notes

- Compact nav row with horizontal scrolling.
- The English journal reader uses scan/transcription columns on wider displays.
- The Welsh journal reader shows its scan beside equal Welsh/English text layers on wider displays; all three layers stack automatically on narrow screens.
- Book and journal page images are touch-friendly and link to full image files for zooming.
- Search results are card-style with larger tap targets.

## Notes

This is an initial scaffold for review before uploading or transcribing real Roberts material.
