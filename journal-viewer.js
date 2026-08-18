const JOURNALS = {
  rdr: {
    key: 'rdr',
    dataPath: 'data/journals/rdr/journal-data.json',
    defaultPage: 3,
    defaultMode: 'transcription',
    modes: [
      ['transcription', 'Transcription'],
      ['original', 'Original'],
      ['side', 'Side by side'],
    ],
  },
  dr: {
    key: 'dr',
    dataPath: 'data/journals/dr/journal-data.json',
    defaultPage: 68,
    defaultMode: 'welsh-english',
    modes: [
      ['welsh-english', 'Welsh + English'],
      ['welsh', 'Welsh'],
      ['english', 'English'],
      ['original', 'Original'],
    ],
  },
};

const params = new URLSearchParams(window.location.search);
const config = JOURNALS[params.get('id')] || JOURNALS.rdr;
const state = {
  journal: null,
  pages: [],
  index: 0,
  mode: params.get('view') || config.defaultMode,
  query: params.get('q') || '',
  zoom: 1,
  fit: 'page',
  touchStart: null,
};

if (!config.modes.some(([value]) => value === state.mode)) state.mode = config.defaultMode;

const ui = {
  title: document.getElementById('journal-title'),
  context: document.getElementById('journal-context'),
  previous: document.getElementById('previous-page'),
  next: document.getElementById('next-page'),
  sidePrevious: document.getElementById('side-previous'),
  sideNext: document.getElementById('side-next'),
  pageInput: document.getElementById('page-number'),
  pageTotal: document.getElementById('page-total'),
  viewModes: document.getElementById('view-modes'),
  zoomControls: document.getElementById('zoom-controls'),
  zoomOut: document.getElementById('zoom-out'),
  zoomIn: document.getElementById('zoom-in'),
  fitPage: document.getElementById('fit-page'),
  fitWidth: document.getElementById('fit-width'),
  searchForm: document.getElementById('journal-search-form'),
  searchInput: document.getElementById('journal-search-input'),
  searchSummary: document.getElementById('search-summary'),
  searchResults: document.getElementById('search-results'),
  status: document.getElementById('reader-status'),
  stage: document.getElementById('journal-page'),
  reference: document.getElementById('page-reference'),
  pageTitle: document.getElementById('page-title'),
  attribution: document.getElementById('page-attribution'),
  transcriptionStatus: document.getElementById('transcription-status'),
  content: document.getElementById('page-content'),
};

function element(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function isPlaceholder(text) {
  return !String(text || '').trim() || /^\[(Untranscribed|Untranslated|Not applicable)/i.test(String(text).trim());
}

function pageNumber(page) {
  return Number(page.pdfPageNumber || page.pageNumber || 1);
}

function manuscriptLabel(page) {
  return page.manuscriptPageNumber ? ` - manuscript page ${page.manuscriptPageNumber}` : '';
}

function pageSearchText(page) {
  if (config.key === 'rdr') return page.transcription || '';
  return [page.welshTranscription, page.translation].filter((value) => !isPlaceholder(value)).join('\n\n');
}

function updateUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('id', config.key);
  url.searchParams.set('page', String(pageNumber(state.pages[state.index])));
  if (state.mode !== config.defaultMode) url.searchParams.set('view', state.mode);
  else url.searchParams.delete('view');
  if (state.query) url.searchParams.set('q', state.query);
  else url.searchParams.delete('q');
  history.replaceState(null, '', url);
}

function appendHighlightedInline(parent, text, query) {
  if (!query) {
    parent.appendChild(document.createTextNode(text));
    return;
  }
  const lower = text.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  let cursor = 0;
  while (cursor < text.length) {
    const match = lower.indexOf(needle, cursor);
    if (match < 0) {
      parent.appendChild(document.createTextNode(text.slice(cursor)));
      break;
    }
    if (match > cursor) parent.appendChild(document.createTextNode(text.slice(cursor, match)));
    parent.appendChild(element('mark', '', text.slice(match, match + query.length)));
    cursor = match + query.length;
  }
}

function renderPlainText(container, text, query = '') {
  container.innerHTML = '';
  if (isPlaceholder(text)) {
    container.appendChild(element('p', 'unfinished-notice', 'Transcription not yet completed.'));
    return;
  }
  String(text).trim().split(/\n\s*\n/).forEach((block) => {
    const paragraph = element('p');
    block.split('\n').forEach((line, index) => {
      if (index) paragraph.appendChild(document.createElement('br'));
      appendHighlightedInline(paragraph, line, query);
    });
    container.appendChild(paragraph);
  });
}

function sourcePanel(page) {
  const panel = element('section', 'source-view');
  panel.appendChild(element('h3', '', 'Original manuscript page'));
  const scroll = element('div', 'scan-scroll');
  const image = document.createElement('img');
  image.src = page.image;
  image.alt = `${state.journal.title}, PDF page ${pageNumber(page)}`;
  image.dataset.sourceImage = 'true';
  scroll.appendChild(image);
  panel.appendChild(scroll);
  const sourceLink = element('a', 'source-page-link', 'Open this page in the unchanged source PDF');
  sourceLink.href = `${state.journal.sourceFile}#page=${pageNumber(page)}`;
  sourceLink.target = '_blank';
  sourceLink.rel = 'noopener';
  panel.appendChild(sourceLink);
  requestAnimationFrame(applyImageScale);
  return panel;
}

function transcriptionPanel(page, text, heading, query = '') {
  const panel = element('section', 'transcription-view');
  panel.appendChild(element('h3', '', heading));
  const body = element('div', 'transcription-body');
  renderPlainText(body, text, query);
  panel.appendChild(body);
  if (page.notes && !/^This PDF page awaits/i.test(page.notes)) {
    const details = element('details', 'editorial-details');
    details.appendChild(element('summary', '', 'Editorial annotations'));
    details.appendChild(element('p', '', page.notes));
    panel.appendChild(details);
  }
  return panel;
}

function renderRdr(page) {
  if (state.mode === 'original') {
    ui.content.appendChild(sourcePanel(page));
    return;
  }
  const transcription = transcriptionPanel(page, page.transcription, 'English transcription', state.query);
  if (state.mode === 'side') {
    const grid = element('div', 'reader-grid');
    grid.appendChild(sourcePanel(page));
    grid.appendChild(transcription);
    ui.content.appendChild(grid);
  } else {
    ui.content.appendChild(transcription);
  }
}

function renderDr(page) {
  if (state.mode === 'original') {
    ui.content.appendChild(sourcePanel(page));
    return;
  }
  const welsh = transcriptionPanel(page, page.welshTranscription, page.sourceTranscriptionLabel || 'Welsh transcription', state.query);
  const english = transcriptionPanel(page, page.translation, page.translationLabel || 'Modern English translation', state.query);
  if (state.mode === 'welsh') ui.content.appendChild(welsh);
  else if (state.mode === 'english') ui.content.appendChild(english);
  else {
    const grid = element('div', 'language-grid');
    welsh.classList.add('language-panel');
    english.classList.add('language-panel');
    grid.appendChild(welsh);
    grid.appendChild(english);
    ui.content.appendChild(grid);
  }
}

function attributionText(page) {
  return [
    page.contentAuthor ? `Content author: ${page.contentAuthor}` : '',
    page.scribe ? `Scribe: ${page.scribe}` : '',
    page.translator ? `Translator: ${page.translator}` : '',
    page.editor ? `Editor: ${page.editor}` : '',
  ].filter(Boolean).join(' - ');
}

function statusText(page) {
  if (page.transcriptionStatus === 'reviewed') return 'Reviewed transcription.';
  if (page.transcriptionStatus === 'needs-review') return 'Working transcription; needs visual review.';
  if (page.transcriptionStatus === 'machine-draft') return 'Machine-assisted draft; needs visual review.';
  return 'Transcription not yet completed.';
}

function renderPage(updateUrlState = true) {
  const page = state.pages[state.index];
  if (!page) return;
  const number = pageNumber(page);
  ui.pageInput.value = String(number);
  ui.previous.disabled = state.index === 0;
  ui.next.disabled = state.index === state.pages.length - 1;
  ui.sidePrevious.disabled = ui.previous.disabled;
  ui.sideNext.disabled = ui.next.disabled;
  ui.reference.textContent = `PDF page ${number}${manuscriptLabel(page)} - ${page.id}`;
  ui.pageTitle.textContent = page.sectionLabel || `${state.journal.title} page ${number}`;
  ui.attribution.textContent = attributionText(page);
  ui.attribution.hidden = !ui.attribution.textContent;
  ui.transcriptionStatus.textContent = statusText(page);
  ui.content.innerHTML = '';
  state.zoom = 1;
  state.fit = 'page';
  if (config.key === 'rdr') renderRdr(page);
  else renderDr(page);
  ui.zoomControls.hidden = !(state.mode === 'original' || state.mode === 'side');
  ui.status.textContent = `Showing PDF page ${number} of ${state.pages.length}.`;
  document.title = `${state.journal.title} - PDF page ${number} | The Roberts Family History`;
  updateModeButtons();
  if (updateUrlState) updateUrl();
}

function goToIndex(index, focusPage = false) {
  state.index = Math.max(0, Math.min(index, state.pages.length - 1));
  renderPage();
  if (focusPage) ui.stage.focus({ preventScroll: true });
}

function goToPageNumber(number, focusPage = false) {
  const index = state.pages.findIndex((page) => pageNumber(page) === Number(number));
  if (index >= 0) goToIndex(index, focusPage);
}

function updateModeButtons() {
  [...ui.viewModes.querySelectorAll('button')].forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
  });
}

function buildModeControls() {
  config.modes.forEach(([value, label]) => {
    const button = element('button', 'mode-control', label);
    button.type = 'button';
    button.dataset.mode = value;
    button.addEventListener('click', () => {
      state.mode = value;
      renderPage();
    });
    ui.viewModes.appendChild(button);
  });
}

function applyImageScale() {
  const image = ui.content.querySelector('[data-source-image="true"]');
  if (!image) return;
  image.style.maxHeight = '';
  image.style.maxWidth = '';
  if (state.fit === 'width') {
    image.style.width = '100%';
  } else if (state.fit === 'page') {
    image.style.width = 'auto';
    image.style.maxWidth = '100%';
    image.style.maxHeight = 'calc(100vh - 230px)';
  } else {
    image.style.width = `${Math.round(state.zoom * 100)}%`;
  }
}

function excerpt(text, query) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  const index = normalized.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  const start = Math.max(0, index - 65);
  const end = Math.min(normalized.length, index + query.length + 95);
  return `${start ? '...' : ''}${normalized.slice(start, end)}${end < normalized.length ? '...' : ''}`;
}

function runSearch(query, update = true) {
  state.query = query.trim();
  ui.searchInput.value = state.query;
  ui.searchResults.innerHTML = '';
  if (state.query.length < 2) {
    ui.searchSummary.textContent = state.query ? 'Enter at least two characters.' : '';
    ui.searchResults.hidden = true;
    renderPage(update);
    return;
  }
  const needle = state.query.toLocaleLowerCase();
  const matches = state.pages.filter((page) => pageSearchText(page).toLocaleLowerCase().includes(needle));
  ui.searchSummary.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'} for "${state.query}".`;
  ui.searchResults.hidden = false;
  matches.forEach((page) => {
    const button = element('button', 'search-result-button');
    button.type = 'button';
    button.appendChild(element('span', 'search-result-label', `PDF page ${pageNumber(page)}${manuscriptLabel(page)}`));
    button.appendChild(element('span', 'search-result-excerpt', excerpt(pageSearchText(page), state.query)));
    button.addEventListener('click', () => {
      goToPageNumber(pageNumber(page), true);
      ui.searchResults.hidden = true;
      ui.searchSummary.textContent = `Opened PDF page ${pageNumber(page)} for "${state.query}".`;
    });
    ui.searchResults.appendChild(button);
  });
  renderPage(update);
}

function wireControls() {
  ui.previous.addEventListener('click', () => goToIndex(state.index - 1));
  ui.next.addEventListener('click', () => goToIndex(state.index + 1));
  ui.sidePrevious.addEventListener('click', () => goToIndex(state.index - 1, true));
  ui.sideNext.addEventListener('click', () => goToIndex(state.index + 1, true));
  ui.pageInput.addEventListener('change', () => goToPageNumber(ui.pageInput.value));
  ui.pageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') goToPageNumber(ui.pageInput.value, true);
  });
  ui.searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runSearch(ui.searchInput.value);
  });
  ui.zoomOut.addEventListener('click', () => {
    state.fit = 'custom';
    state.zoom = Math.max(.5, state.zoom - .2);
    applyImageScale();
  });
  ui.zoomIn.addEventListener('click', () => {
    state.fit = 'custom';
    state.zoom = Math.min(3, state.zoom + .2);
    applyImageScale();
  });
  ui.fitPage.addEventListener('click', () => { state.fit = 'page'; applyImageScale(); });
  ui.fitWidth.addEventListener('click', () => { state.fit = 'width'; applyImageScale(); });

  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('input, button, a, summary')) return;
    if (!window.getSelection()?.isCollapsed) return;
    if (event.key === 'ArrowLeft') goToIndex(state.index - 1, true);
    if (event.key === 'ArrowRight') goToIndex(state.index + 1, true);
  });

  ui.stage.addEventListener('touchstart', (event) => {
    if (event.target.closest('.scan-scroll') || !window.getSelection()?.isCollapsed) return;
    const touch = event.changedTouches[0];
    state.touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  ui.stage.addEventListener('touchend', (event) => {
    if (!state.touchStart || event.target.closest('.scan-scroll')) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - state.touchStart.x;
    const dy = touch.clientY - state.touchStart.y;
    state.touchStart = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) goToIndex(state.index + 1, true);
    else goToIndex(state.index - 1, true);
  }, { passive: true });

  window.addEventListener('popstate', () => window.location.reload());
}

async function init() {
  buildModeControls();
  wireControls();
  try {
    const response = await fetch(config.dataPath);
    if (!response.ok) throw new Error(`Unable to load journal data (${response.status})`);
    const data = await response.json();
    state.journal = data.journals[0];
    state.pages = [...data.journalPages].sort((a, b) => pageNumber(a) - pageNumber(b));
    ui.title.textContent = state.journal.title;
    ui.context.textContent = [
      state.journal.primaryWriter ? `Primary writer/compiler: ${state.journal.primaryWriter}` : '',
      `${state.pages.length} PDF pages`,
      state.journal.language,
    ].filter(Boolean).join(' - ');
    ui.pageInput.max = String(state.pages.length);
    ui.pageTotal.textContent = `of ${state.pages.length}`;
    const requestedPage = Number(params.get('page')) || config.defaultPage;
    const requestedIndex = state.pages.findIndex((page) => pageNumber(page) === requestedPage);
    state.index = requestedIndex >= 0 ? requestedIndex : 0;
    ui.searchInput.value = state.query;
    renderPage(false);
    if (state.query) runSearch(state.query, false);
    updateUrl();
  } catch (error) {
    ui.status.textContent = error.message;
    ui.content.innerHTML = '';
    ui.content.appendChild(element('p', 'unfinished-notice', 'The journal reader could not load its structured data.'));
  }
}

init();
