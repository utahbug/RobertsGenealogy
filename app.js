const appState = {
  data: null,
  bookState: { pages: [], activeIndex: 0 },
  journalReaders: new Map(),
  correspondenceReader: null,
  searchIndex: [],
};

const panelButtons = [...document.querySelectorAll('.nav-button')];
const panels = [...document.querySelectorAll('.content-panel')];

const status = {
  story: document.getElementById('story-status'),
  family: document.getElementById('family-status') || document.getElementById('charts-status'),
  namesPlaces: document.getElementById('names-places-status'),
  book: document.getElementById('book-status'),
  journals: document.getElementById('journals-status'),
  sources: document.getElementById('sources-status'),
  search: document.getElementById('search-status'),
};

const namesPlacesState = {
  entries: [],
  filter: 'all',
  search: '',
};

const namesPlacesControls = {
  search: document.getElementById('names-places-search'),
  filters: [...document.querySelectorAll('.nameplace-filters .filter-button')],
  content: document.getElementById('names-places-content'),
  detail: document.getElementById('names-places-detail'),
};

const bookControls = {
  first: document.getElementById('book-first'),
  prev: document.getElementById('book-prev'),
  next: document.getElementById('book-next'),
  last: document.getElementById('book-last'),
  input: document.getElementById('book-page-input'),
  go: document.getElementById('book-go'),
  total: document.getElementById('book-page-total'),
  title: document.getElementById('book-page-title'),
  viewer: document.getElementById('book-viewer'),
};

function el(tag, attrs = {}, children = '') {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'dataset' && value && typeof value === 'object') {
      Object.entries(value).forEach(([dk, dv]) => {
        node.dataset[dk] = dv;
      });
    } else if (key === 'className') {
      node.className = value;
    } else if (key === 'text') {
      node.textContent = value;
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== false && value != null) {
      node.setAttribute(key, value);
    }
  });

  if (Array.isArray(children)) {
    children.forEach((child) => {
      if (child == null) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
  } else if (children) {
    node.appendChild(typeof children === 'string' ? document.createTextNode(children) : children);
  }

  return node;
}

function makeZoomImage(src, alt) {
  return el('a', { href: src, target: '_blank', rel: 'noopener', className: 'zoom-link', text: '' }, [
    el('img', { src, alt }),
  ]);
}

function findById(collection, id) {
  return collection.find((item) => item.id === id);
}

function mergeById(baseItems = [], addedItems = []) {
  const merged = new Map(baseItems.map((item) => [item.id, item]));
  addedItems.forEach((item) => {
    merged.set(item.id, { ...(merged.get(item.id) || {}), ...item });
  });
  return [...merged.values()];
}

function sourcePagesFor(item) {
  return item.sourcePages || item.bookPages || [];
}

function sortedByDate(items) {
  return [...items].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

function getBookPages() {
  if (!appState.data || !Array.isArray(appState.data.bookPages)) return [];
  return [...appState.data.bookPages].sort((a, b) => Number(a.pageNumber || 0) - Number(b.pageNumber || 0));
}

function bookIndexFromId(pageId) {
  return getBookPages().findIndex((page) => page.id === pageId);
}

function formatBookLabel(index, total) {
  return `Book page ${String(index + 1).padStart(3, '0')} of ${String(total).padStart(2, '0')}`;
}

function renderCurrentBookPage(index, updateHash = true) {
  const pages = appState.bookState.pages;
  if (!pages.length || !bookControls.viewer) return;

  const bounded = Math.max(0, Math.min(index, pages.length - 1));
  appState.bookState.activeIndex = bounded;
  const page = pages[bounded];

  bookControls.title.textContent = `${formatBookLabel(bounded, pages.length)} · ${page.bookId || 'Source book'}`;
  bookControls.input.value = String(page.pageNumber || bounded + 1);
  bookControls.prev.disabled = bounded <= 0;
  bookControls.next.disabled = bounded >= pages.length - 1;

  bookControls.viewer.innerHTML = '';
  bookControls.viewer.appendChild(
    el('div', { className: 'book-page-figure' }, [
      makeZoomImage(page.image, `Book page image ${page.pageNumber}`),
      el('div', { className: 'book-caption', text: page.caption || 'Historical book scan (original page).' }),
    ])
  );

  bookControls.viewer.appendChild(
    el('div', { className: 'section-links' }, [
      el('span', { className: 'tag', text: 'Linked:' }),
      ...(page.linkedEvents || []).map((id) => {
        const event = findById(appState.data.events, id);
        if (!event) return null;
        return el('a', {
          className: 'link-chip',
          href: '#',
          text: event.title,
          onClick: (eventObj) => {
            eventObj.preventDefault();
            focusPanel('story');
            navigateSearchTo(event.id);
          },
        });
      }).filter(Boolean),
    ])
  );

  if (updateHash) {
    const hash = `#${page.id}`;
    if (window.location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
  }

  status.book.textContent = `Showing source page ${bounded + 1} of ${pages.length}.`;
}

function wireBookControls() {
  if (!bookControls.first) return;
  bookControls.first.addEventListener('click', () => renderCurrentBookPage(0));
  bookControls.prev.addEventListener('click', () => renderCurrentBookPage(appState.bookState.activeIndex - 1));
  bookControls.next.addEventListener('click', () => renderCurrentBookPage(appState.bookState.activeIndex + 1));
  bookControls.last.addEventListener('click', () => renderCurrentBookPage(appState.bookState.pages.length - 1));
  bookControls.go.addEventListener('click', jumpToInputPage);
  bookControls.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      jumpToInputPage();
    }
  });
}

function jumpToInputPage() {
  const raw = Number(bookControls.input.value);
  if (!Number.isFinite(raw)) return;
  const pages = appState.bookState.pages;
  const target = Math.max(1, Math.min(Math.round(raw), pages.length || 1));
  renderCurrentBookPage(target - 1);
}

function openBookById(pageId, updateHash = true) {
  const index = bookIndexFromId(pageId);
  if (index < 0) return;
  renderCurrentBookPage(index, updateHash);
}

function buildTagRow(items, label, getText) {
  if (!items || !items.length) return null;
  const row = el('div', { className: 'tag-row' });
  row.appendChild(el('strong', { text: `${label}:` }));
  items.forEach((item) => {
    row.appendChild(el('span', { className: 'tag', text: getText(item) }));
  });
  return row;
}

function buildLinks(ids, type, fallback, sourceCollection, labelFn) {
  if (!ids || !ids.length) return el('span', { text: '' });
  const wrapper = el('div', { className: 'section-links' });
  wrapper.appendChild(el('span', { className: 'tag', text: `${fallback}:` }));
  ids.forEach((id) => {
    const item = findById(sourceCollection, id);
    if (!item) return;
    const label = labelFn(item);
    const isCorrectionNote = type === 'note' && item && item.type === 'correction';
    wrapper.appendChild(el('a', {
      className: isCorrectionNote ? 'link-chip note-correction' : 'link-chip',
      href: '#',
      text: label,
      onClick: (e) => {
        e.preventDefault();
        if (type === 'book') {
          focusPanel('book');
          openBookById(item.id);
          return;
        }
        if (type === 'journal') {
          focusPanel('journals');
          openJournalPageById(item.id);
        } else if (type === 'story') {
          focusPanel('story');
          navigateSearchTo(id);
        } else if (type === 'note') {
          focusPanel('search');
          navigateSearchTo(id);
        } else {
          focusPanel('sources');
          navigateSearchTo(id);
        }
      },
    }));
  });
  return wrapper;
}

function renderEvent(event, data) {
  const eventCard = el('article', { className: 'event-card', id: `event-${event.id}` });
  eventCard.appendChild(el('h3', { className: 'card-title', html: `${event.title} <span class="source-type">(DEMO)</span>` }));
  eventCard.appendChild(el('p', {
    className: 'meta',
    html: `<span class="date-mark">${event.date || 'DEMO date missing'}</span> • Event ${event.id}`,
  }));

  const people = (event.people || [])
    .map((id) => findById(data.people, id))
    .filter(Boolean)
    .map((person) => person.name);
  const places = (event.places || [])
    .map((id) => findById(data.places, id))
    .filter(Boolean)
    .map((place) => place.name);

  eventCard.appendChild(el('p', { text: event.originalSourceText || 'Source text pending. (DEMO)' }));
  eventCard.appendChild(el('p', { className: 'meta', text: event.editorialNarrative || 'Editorial context pending. (DEMO)' }));

  const peopleRow = buildTagRow(people, 'People', (name) => name);
  if (peopleRow) eventCard.appendChild(peopleRow);

  const placeRow = buildTagRow(places, 'Places', (name) => name);
  if (placeRow) eventCard.appendChild(placeRow);

  const links = el('div', { className: 'section-links' });
  links.appendChild(buildLinks(event.bookPages || [], 'book', 'Book pages', data.bookPages, (p) => `Book ${p.pageNumber}`));
  links.appendChild(buildLinks(event.journalPages || [], 'journal', 'Journal pages', data.journalPages, (p) => `${p.journalTitle} p.${p.pageNumber}`));
  links.appendChild(buildLinks(event.sources || [], 'source', 'Sources', data.sources, (s) => s.title));
  links.appendChild(buildLinks(event.editorialNotes || [], 'note', 'Editorial notes', data.editorialNotes, (n) => n.title));
  eventCard.appendChild(links);

  return eventCard;
}

function journalAlias(journalId) {
  if (journalId === 'journal-rdr-001') return 'rdr';
  if (journalId === 'journal-dr-001') return 'dr';
  return '';
}

function journalPageIsStarted(page) {
  const text = String(page.transcription || page.welshTranscription || '').trim();
  return Boolean(text && !/^\[(Untranscribed|Untranslated|Not applicable)/i.test(text));
}

function journalViewerUrl(journal, pageNumber, query = '') {
  const alias = journalAlias(journal.id);
  const preferredPage = pageNumber || (alias === 'dr' ? 68 : 3);
  const params = new URLSearchParams({ id: alias, page: String(preferredPage) });
  if (query.trim()) params.set('q', query.trim());
  return `journal-viewer.html?${params.toString()}`;
}

function renderJournal(journal, data) {
  const pages = (data.journalPages || [])
    .filter((page) => page.journalId === journal.id)
    .sort((a, b) => Number(a.pdfPageNumber || a.pageNumber) - Number(b.pdfPageNumber || b.pageNumber));
  const alias = journalAlias(journal.id);
  const card = el('article', { className: 'journal-catalog-entry' });
  const summary = alias === 'rdr'
    ? 'Original English manuscript with typed transcription'
    : 'Shared Welsh manuscript with modern English translation';
  const started = pages.filter(journalPageIsStarted).length;
  const reviewed = pages.filter((page) => page.transcriptionStatus === 'reviewed').length;

  card.appendChild(el('p', { className: 'journal-catalog-kicker', text: 'Historical volume' }));
  card.appendChild(el('h3', { className: 'journal-catalog-title', text: journal.title }));
  card.appendChild(el('p', { className: 'journal-catalog-summary', text: summary }));
  card.appendChild(el('p', {
    className: 'journal-catalog-meta',
    text: `${journal.pdfPageCount || pages.length} PDF pages${journal.language ? ` · ${journal.language}` : ''}`,
  }));

  if (alias === 'rdr') {
    card.appendChild(el('p', {
      text: "Mostly written and compiled by Robert D. Roberts; later continued by David D. Roberts. The opening portion preserves Robert D. Roberts's historical English translation/copy of David Roberts's Welsh record.",
    }));
    card.appendChild(el('p', {
      className: 'journal-progress',
      text: `Transcription progress: ${started} / ${pages.length} pages started · ${reviewed} reviewed`,
    }));
  } else {
    card.appendChild(el('p', {
      text: 'One physical source begun by David Roberts and continued by later Roberts-family contributors. Pages 68-72 are confirmed David Roberts handwriting; pages 73-76 contain mixed source layers; lower page 76 onward moves into Robert D. Roberts material.',
    }));
    card.appendChild(el('p', {
      className: 'journal-progress',
      text: 'Family-history pages 68-109 have complete first-pass source text and modern English where applicable. Needs review identifies documented scholarly uncertainty, not missing transcription.',
    }));
  }

  const actions = el('div', { className: 'journal-catalog-actions', 'aria-label': `${journal.title} actions` });
  actions.appendChild(el('a', {
    className: 'catalog-action catalog-action-primary',
    href: journalViewerUrl(journal),
    text: alias === 'rdr' ? 'Read original / transcription' : 'Read manuscript / translation',
  }));
  if (alias === 'dr') {
    actions.appendChild(el('a', {
      className: 'catalog-action',
      href: 'output/pdf/David-Roberts-Welsh-Journal-English-Left-Welsh-Right.pdf',
      target: '_blank',
      rel: 'noopener',
      title: 'Source PDF pages 68-109',
      text: 'Bilingual PDF - English left / Welsh right',
    }));
  }
  if (journal.sourceFile) {
    actions.appendChild(el('a', {
      className: 'catalog-action',
      href: journal.sourceFile,
      target: '_blank',
      rel: 'noopener',
      text: 'View original',
    }));
  }
  if (alias === 'rdr') {
    const wordDownload = (journal.downloads || []).find((download) => /Word/i.test(download.label));
    if (wordDownload) {
      actions.appendChild(el('a', {
        className: 'catalog-action',
        href: wordDownload.path,
        text: 'Download Word',
      }));
    }
  }
  card.appendChild(actions);
  return card;
}

function openJournalPageById(pageId, query = '') {
  const page = findById(appState.data?.journalPages || [], pageId);
  if (!page) return;
  const journal = findById(appState.data?.journals || [], page.journalId);
  if (!journal) return;
  window.location.href = journalViewerUrl(journal, page.pdfPageNumber || page.pageNumber, query);
}

function renderSource(source) {
  const card = el('article', { className: 'source-card', id: `source-${source.id}` });
  const demoLabel = source.demo === false ? '' : ' (DEMO)';
  card.appendChild(el('h3', { className: 'card-title', text: `${source.title}${demoLabel}` }));
  card.appendChild(el('p', { className: 'meta', text: `${source.sourceType || source.type || 'Source'} • ${source.date || 'date not set'}` }));
  card.appendChild(el('p', { text: source.description || source.summary || 'No description available.' }));
  const repository = source.location || source.repository;
  if (repository) card.appendChild(el('p', { className: 'meta', text: `Repository: ${repository}` }));
  if (source.citation) card.appendChild(el('p', { className: 'meta', text: `Citation: ${source.citation}` }));

  if (source.supports?.length) {
    card.appendChild(buildLinks(source.supports, 'story', 'Supports', appState.data.events, (e) => e.title));
  }

  return card;
}

function correspondenceParticipantLabel(item) {
  const sender = item.senderDisplay || (item.senders || []).join(' and ') || 'Sender not identified';
  const recipient = item.recipientDisplay || (item.recipients || []).join(' and ') || 'Recipient not identified';
  return `${sender} -> ${recipient}`;
}

function renderCorrespondence(data) {
  const host = document.getElementById('sources-content');
  const collections = data.correspondenceCollections || [];
  const pages = [...(data.correspondencePages || [])].sort((a, b) => a.pdfPageNumber - b.pdfPageNumber);
  const items = [...(data.letters || [])].sort((a, b) => (a.sortDate || '9999-99-99').localeCompare(b.sortDate || '9999-99-99') || a.id.localeCompare(b.id));
  if (!host || !collections.length || !pages.length) return;

  const collection = collections[0];
  const section = el('section', { className: 'correspondence-section', id: collection.id });
  section.appendChild(el('p', { className: 'eyebrow', text: 'Letters & Correspondence' }));
  section.appendChild(el('h3', { className: 'card-title correspondence-title', text: collection.title }));
  section.appendChild(el('p', { text: collection.description }));
  section.appendChild(el('p', { className: 'journal-context-note', text: collection.sourceLayerNote }));
  section.appendChild(el('p', { className: 'meta', text: `${collection.pdfPageCount} supplied compilation pages • ${items.length} identifiable letters/items • Stable collection ID: ${collection.id}` }));

  const browseHeading = el('h4', { className: 'reader-heading', text: 'Browse identifiable correspondence' });
  section.appendChild(browseHeading);

  const browseControls = el('div', { className: 'correspondence-browse-controls' });
  const modes = [
    ['all', 'All'],
    ['date', 'Date'],
    ['participant', 'Sender / Recipient'],
    ['place', 'Place'],
  ];
  const modeButtons = modes.map(([mode, label], index) => el('button', {
    type: 'button',
    className: `filter-button${index === 0 ? ' is-active' : ''}`,
    text: label,
    dataset: { mode },
  }));
  modeButtons.forEach((button) => browseControls.appendChild(button));
  const filterValue = el('select', { className: 'correspondence-filter-value', 'aria-label': 'Correspondence filter value' });
  filterValue.hidden = true;
  browseControls.appendChild(filterValue);
  const localSearch = el('input', {
    type: 'search',
    className: 'correspondence-search',
    placeholder: 'Search letters, people, places, or supplied text',
    'aria-label': 'Search Roberts Family Correspondence',
  });
  browseControls.appendChild(localSearch);
  section.appendChild(browseControls);

  const itemStatus = el('p', { className: 'status-note', role: 'status', 'aria-live': 'polite' });
  const itemList = el('div', { className: 'correspondence-item-list' });
  section.appendChild(itemStatus);
  section.appendChild(itemList);

  const readerHeading = el('h4', { className: 'reader-heading correspondence-reader-heading', text: 'Compilation page reader' });
  section.appendChild(readerHeading);
  const toolbar = el('div', { className: 'journal-toolbar correspondence-toolbar', role: 'group', 'aria-label': 'Correspondence page controls' });
  const prevButton = el('button', { type: 'button', className: 'journal-control', text: 'Previous' });
  const nextButton = el('button', { type: 'button', className: 'journal-control', text: 'Next' });
  const pageInput = el('input', { type: 'number', className: 'journal-page-input', min: 1, max: pages.length, value: 1, 'aria-label': 'Correspondence PDF page number' });
  const goButton = el('button', { type: 'button', className: 'journal-control', text: 'Go' });
  toolbar.appendChild(prevButton);
  toolbar.appendChild(el('div', { className: 'journal-page-jump' }, [el('span', { text: 'PDF page' }), pageInput, el('span', { text: `/ ${pages.length}` }), goButton]));
  toolbar.appendChild(nextButton);
  section.appendChild(toolbar);
  const pageHost = el('div', { className: 'correspondence-page-host' });
  section.appendChild(pageHost);
  host.appendChild(section);

  let activePageIndex = 0;
  let activeItemId = '';
  let filterMode = 'all';

  const openPageAt = (requestedIndex, updateHash = true) => {
    activePageIndex = Math.max(0, Math.min(requestedIndex, pages.length - 1));
    const page = pages[activePageIndex];
    pageInput.value = String(page.pdfPageNumber);
    prevButton.disabled = activePageIndex === 0;
    nextButton.disabled = activePageIndex === pages.length - 1;
    pageHost.innerHTML = '';

    const panel = el('article', { className: 'event-card correspondence-page-panel', id: page.id });
    panel.appendChild(el('h5', { className: 'card-title', text: `Roberts Family Correspondence - PDF page ${page.pdfPageNumber}` }));
    panel.appendChild(el('p', { className: 'meta', text: `Stable page ID: ${page.id}` }));

    const pageItems = (page.itemIds || []).map((id) => findById(items, id)).filter(Boolean);
    if (pageItems.length) {
      const itemMeta = el('div', { className: 'correspondence-page-items' });
      pageItems.forEach((item) => {
        itemMeta.appendChild(el('div', { className: `correspondence-page-item${item.id === activeItemId ? ' is-active' : ''}` }, [
          el('strong', { text: item.title }),
          el('span', { className: 'meta', text: `${item.dateDisplay} • ${item.textTypeLabel}` }),
        ]));
      });
      panel.appendChild(itemMeta);
    }

    const reader = el('div', { className: 'correspondence-reader-grid' });
    const pageColumn = el('div', { className: 'journal-source-column' });
    pageColumn.appendChild(el('h6', { className: 'reader-heading', text: 'Supplied compilation page' }));
    pageColumn.appendChild(el('div', { className: 'image-frame' }, [makeZoomImage(page.image, `Roberts Family Correspondence PDF page ${page.pdfPageNumber}`)]));
    pageColumn.appendChild(el('a', {
      className: 'journal-pdf-link',
      href: `${collection.sourceFile}#page=${page.pdfPageNumber}`,
      target: '_blank',
      rel: 'noopener',
      text: 'Open this page in the unchanged source compilation PDF',
    }));
    reader.appendChild(pageColumn);

    const textColumn = el('div', { className: 'reader-text correspondence-text-column' });
    textColumn.appendChild(el('h6', { className: 'reader-heading', text: 'Selectable supplied text' }));
    textColumn.appendChild(el('p', { className: 'meta', text: 'This is the compilation text as supplied, not a project-corrected transcription or a claim that an original manuscript survives.' }));
    textColumn.appendChild(el('pre', { className: 'transcription-text correspondence-page-text', text: page.suppliedText || '[No supplied text extracted]' }));
    reader.appendChild(textColumn);
    panel.appendChild(reader);
    pageHost.appendChild(panel);
    if (updateHash) history.replaceState(null, '', `#${page.id}`);
  };

  const openLetter = (letterId, updateHash = true) => {
    const item = findById(items, letterId);
    if (!item) return;
    activeItemId = item.id;
    const pageIndex = pages.findIndex((page) => page.id === item.sourcePageIds?.[0]);
    if (pageIndex >= 0) openPageAt(pageIndex, updateHash);
    itemList.querySelectorAll('[data-letter-id]').forEach((button) => button.classList.toggle('is-active', button.dataset.letterId === item.id));
    pageHost.scrollIntoView({ block: 'nearest' });
  };

  const rebuildFilterValues = () => {
    filterValue.innerHTML = '';
    filterValue.appendChild(el('option', { value: '', text: 'All values' }));
    let values = [];
    if (filterMode === 'date') {
      values = [...new Set(items.map((item) => item.date ? `${item.date.slice(0, 3)}0s` : 'Uncertain / undated'))];
    } else if (filterMode === 'participant') {
      values = [...new Set(items.flatMap((item) => [...(item.senders || []), ...(item.recipients || [])]))];
    } else if (filterMode === 'place') {
      values = [...new Set(items.flatMap((item) => item.placeNames || [item.origin, item.destination]).filter(Boolean))];
    }
    values.sort((a, b) => a.localeCompare(b));
    values.forEach((value) => filterValue.appendChild(el('option', { value, text: value })));
    filterValue.hidden = filterMode === 'all';
  };

  const renderItemList = () => {
    const query = localSearch.value.trim().toLowerCase();
    const selected = filterValue.value;
    const visible = items.filter((item) => {
      const matchesQuery = !query || item.searchText.includes(query);
      if (!matchesQuery || !selected) return matchesQuery;
      if (filterMode === 'date') return item.date ? `${item.date.slice(0, 3)}0s` === selected : selected === 'Uncertain / undated';
      if (filterMode === 'participant') return [...(item.senders || []), ...(item.recipients || [])].includes(selected);
      if (filterMode === 'place') return (item.placeNames || [item.origin, item.destination]).includes(selected);
      return true;
    });
    itemStatus.textContent = `${visible.length} of ${items.length} identifiable correspondence items shown.`;
    itemList.innerHTML = '';
    visible.forEach((item) => {
      const button = el('button', {
        type: 'button',
        className: `correspondence-item-button${item.id === activeItemId ? ' is-active' : ''}`,
        dataset: { letterId: item.id },
        onClick: () => openLetter(item.id),
      });
      button.appendChild(el('strong', { text: item.title }));
      button.appendChild(el('span', { className: 'meta', text: [item.origin, item.destination, `PDF ${item.pdfPages.join(', ')}`, item.dateCertainty !== 'exact' ? `Date: ${item.dateCertainty}` : ''].filter(Boolean).join(' • ') }));
      if (item.notes) button.appendChild(el('span', { className: 'meta', text: item.notes }));
      itemList.appendChild(button);
    });
  };

  modeButtons.forEach((button) => button.addEventListener('click', () => {
    modeButtons.forEach((candidate) => candidate.classList.remove('is-active'));
    button.classList.add('is-active');
    filterMode = button.dataset.mode;
    rebuildFilterValues();
    renderItemList();
  }));
  filterValue.addEventListener('change', renderItemList);
  localSearch.addEventListener('input', renderItemList);
  prevButton.addEventListener('click', () => openPageAt(activePageIndex - 1));
  nextButton.addEventListener('click', () => openPageAt(activePageIndex + 1));
  goButton.addEventListener('click', () => {
    const requested = Number(pageInput.value);
    if (Number.isFinite(requested)) openPageAt(Math.round(requested) - 1);
  });
  pageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') goButton.click();
  });

  rebuildFilterValues();
  renderItemList();
  openPageAt(0, false);
  appState.correspondenceReader = {
    openPage(pageId, updateHash = true) {
      const index = pages.findIndex((page) => page.id === pageId);
      if (index >= 0) openPageAt(index, updateHash);
    },
    openLetter,
  };
}

function openCorrespondencePageById(pageId, updateHash = true) {
  if (!appState.correspondenceReader) return;
  focusPanel('sources');
  appState.correspondenceReader.openPage(pageId, updateHash);
  document.getElementById(pageId)?.scrollIntoView({ block: 'nearest' });
}

function openCorrespondenceItemById(letterId, updateHash = true) {
  if (!appState.correspondenceReader) return;
  focusPanel('sources');
  appState.correspondenceReader.openLetter(letterId, updateHash);
}

function renderPersonDetail(person, data) {
  const detail = document.getElementById('family-person-detail');
  detail.hidden = false;
  detail.innerHTML = '';

  const panel = el('article', { className: 'person-detail-card' });
  panel.appendChild(el('h3', { className: 'card-title', text: person.displayName || person.name }));
  panel.appendChild(el('p', { className: 'meta', text: `ID: ${person.id}` }));

  if (person.generationLabel) {
    panel.appendChild(el('p', { className: 'meta', text: person.generationLabel }));
  }

  if (person.summary) {
    panel.appendChild(el('p', { text: person.summary }));
  } else {
    panel.appendChild(el('p', { text: 'No biographical summary has been added.' }));
  }

  const personAliases = [...new Set([...(person.aliases || []), ...(person.variants || [])])];
  if (personAliases.length) {
    panel.appendChild(el('p', { className: 'meta', text: `Aliases / source variants: ${personAliases.join(', ')}` }));
  }

  if (person.historicalRoles?.length) {
    panel.appendChild(buildTagRow(person.historicalRoles, 'Historical roles', (role) => role));
  }

  if (person.birthDate || person.deathDate || person.birthPlace || person.deathPlace) {
    const lines = [
      person.birthDate ? `Born: ${person.birthDate}` : null,
      person.deathDate ? `Died: ${person.deathDate}` : null,
      person.birthPlace ? `Birth place: ${person.birthPlace}` : null,
      person.deathPlace ? `Death place: ${person.deathPlace}` : null,
    ].filter(Boolean);
    panel.appendChild(el('p', { className: 'meta', text: lines.join(' • ') }));
  }

  if (person.image) {
    panel.appendChild(el('div', { className: 'image-frame family-person-image' }, [makeZoomImage(person.image, `${person.name} image`)]));
  }

  const spouseNames = (person.spouses || [])
    .map((id) => findById(data.people, id))
    .filter(Boolean)
    .map((personRecord) => personRecord.name);
  if (spouseNames.length) {
    panel.appendChild(buildTagRow(spouseNames, 'Spouses', (name) => name));
  }

  const parentNames = (person.parents || [])
    .map((id) => findById(data.people, id))
    .filter(Boolean)
    .map((personRecord) => personRecord.name);
  if (parentNames.length) {
    panel.appendChild(buildTagRow(parentNames, 'Parents', (name) => name));
  }

  const childNames = (person.children || [])
    .map((id) => findById(data.people, id))
    .filter(Boolean)
    .map((personRecord) => personRecord.name);
  if (childNames.length) {
    panel.appendChild(buildTagRow(childNames, 'Children', (name) => name));
  }

  panel.appendChild(buildLinks(sourcePagesFor(person), 'book', 'Book pages', data.bookPages, (item) => `Book ${item.pageNumber}`));
  panel.appendChild(buildLinks(person.journalPages || [], 'journal', 'Journal pages', data.journalPages, (item) => `${item.journalTitle} p.${item.pageNumber}`));
  panel.appendChild(buildLinks(person.sources || [], 'source', 'Sources', data.sources, (sourceRecord) => sourceRecord.title));
  panel.appendChild(buildLinks(person.editorialNotes || [], 'note', 'Editorial notes', data.editorialNotes, (note) => note.title));

  if (person.notes) {
    panel.appendChild(el('p', { text: person.notes }));
  }

  panel.appendChild(
    el('button', {
      type: 'button',
      className: 'detail-close',
      text: 'Hide details',
      onClick: () => {
        detail.hidden = true;
        document.querySelectorAll('[data-person-id]').forEach((btn) => btn.classList.remove('person-card--active'));
      },
    })
  );

  detail.appendChild(panel);
}

function renderFamilyCard(person, data) {
  const card = el('button', {
    type: 'button',
    className: 'person-card',
    'data-person-id': person.id,
    onClick: () => {
      document.querySelectorAll('[data-person-id]').forEach((btn) => btn.classList.remove('person-card--active'));
      card.classList.add('person-card--active');
      renderPersonDetail(person, data);
    },
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        card.click();
      }
    },
  });
  card.setAttribute('aria-label', `Open details for ${person.name}`);
  card.appendChild(el('div', { className: 'person-card__name', text: person.name }));
  card.appendChild(el('div', { className: 'meta', text: person.summary || person.relationship || 'Details available from the source index.' }));
  return card;
}

function renderFamilyNode(person, spouse, data) {
  const node = el('article', { className: 'couple-node' });
  node.appendChild(el('div', { className: 'generation-title', text: person.generationLabel || 'Generation' }));
  const pair = el('div', { className: 'family-pair' });
  pair.appendChild(renderFamilyCard(person, data));
  pair.appendChild(renderFamilyCard(spouse || {
    id: `${person.id}-spouse-missing`,
    name: 'Spouse not yet identified',
    summary: 'No spouse record is connected in the current chart data.',
  }, data));
  node.appendChild(pair);
  return node;
}

function renderFamily(data) {
  const chart = document.getElementById('family-chart');
  const detail = document.getElementById('family-person-detail');
  const lineage = data.genealogy?.primaryLine || [];
  chart.innerHTML = '';
  detail.innerHTML = '';
  detail.hidden = true;

  if (!lineage.length) {
    status.family.textContent = 'No ancestry lineage has been configured in the genealogy data.';
    return;
  }

  const peopleById = new Map((data.people || []).map((person) => [person.id, person]));
  const chain = el('div', { className: 'family-chain' });

  lineage.forEach((personId, index) => {
    const person = peopleById.get(personId);
    if (!person) return;
    const spouseId = (person.spouses || [])[0];
    const spouse = spouseId ? peopleById.get(spouseId) : null;
    chain.appendChild(renderFamilyNode(person, spouse, data));
    if (index < lineage.length - 1) {
      chain.appendChild(el('div', { className: 'family-connector', 'aria-hidden': 'true', text: '↓' }));
    }
  });

  chart.appendChild(chain);
  status.family.textContent = `${lineage.length} generation nodes loaded.`;

  const finalPerson = peopleById.get(lineage[lineage.length - 1]);
  if (finalPerson) {
    renderPersonDetail(finalPerson, data);
    const button = chart.querySelector(`[data-person-id="${finalPerson.id}"]`);
    if (button) button.classList.add('person-card--active');
  }
}

function buildNamesPlacesEntries(data) {
  const people = (data.people || [])
    .filter((person) => (person.indexScope === 'book-pages-001-068' && sourcePagesFor(person).length) || (person.sourceOccurrences || []).some((occurrence) => occurrence.sourceType === 'correspondence'))
    .map((person) => ({
    id: person.id,
    type: 'person',
    kind: 'Person',
    displayName: person.displayName || person.name,
    nameAsWritten: person.nameAsWritten || person.name || '',
    variants: person.variants || [],
    sourcePages: sourcePagesFor(person),
    relatedPersonId: person.relatedPedigreePersonId || '',
    relatedPeople: person.relatedPeople || [],
    notes: person.notes || '',
    locality: person.locality || person.birthPlace || '',
    county: person.county || '',
    uncertainty: Boolean(person.uncertainty),
    uncertaintyNote: person.uncertaintyNote || '',
    relationship: person.relationship || person.generationLabel || '',
    correspondenceOccurrences: (person.sourceOccurrences || []).filter((occurrence) => occurrence.sourceType === 'correspondence'),
    searchText: [person.name, person.nameAsWritten, person.displayName, person.relationship, person.locality, person.county, ...(person.variants || []), ...sourcePagesFor(person), ...(person.sourceOccurrences || []).flatMap((occurrence) => [occurrence.letterId, occurrence.sourcePageId, occurrence.role])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  }));

  const places = (data.places || [])
    .filter((place) => (place.indexScope === 'book-pages-001-068' && sourcePagesFor(place).length) || (place.sourceOccurrences || []).some((occurrence) => occurrence.sourceType === 'correspondence'))
    .map((place) => {
    const rawType = (place.type || 'place').toLowerCase();
    const homeTypes = ['home', 'farm', 'house', 'estate', 'property', 'quarry', 'factory', 'mine'];
    const isHomeProperty = place.category === 'homes-properties' || homeTypes.includes(rawType);
    return {
      id: place.id,
      type: isHomeProperty ? 'home' : rawType,
      kind: place.displayType || (isHomeProperty ? 'Home / Property' : 'Place'),
      displayName: place.displayName || place.name,
      nameAsWritten: place.nameAsWritten || place.name,
      variants: place.variants || [],
      sourcePages: sourcePagesFor(place),
      relatedPeople: place.relatedPeople || [],
      notes: place.notes || '',
      locality: place.locality || '',
      county: place.county || place.historicalCounty || '',
      englishGloss: place.englishGloss || '',
      uncertainty: Boolean(place.uncertainty),
      uncertaintyNote: place.uncertaintyNote || '',
      correspondenceOccurrences: (place.sourceOccurrences || []).filter((occurrence) => occurrence.sourceType === 'correspondence'),
      searchText: [place.name, place.nameAsWritten, place.displayName, place.displayType, place.locality, place.county, place.englishGloss, ...(place.variants || []), ...sourcePagesFor(place), ...(place.sourceOccurrences || []).flatMap((occurrence) => [occurrence.letterId, occurrence.sourcePageId])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    };
  });

  return [...people, ...places].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function renderNamesPlacesContent() {
  const visible = namesPlacesState.entries.filter((entry) => {
    const byType =
      namesPlacesState.filter === 'all'
        ? true
        : namesPlacesState.filter === 'people'
          ? entry.type === 'person'
          : namesPlacesState.filter === 'places'
            ? entry.type !== 'person' && entry.type !== 'home'
            : entry.type === 'home';

    const bySearch = !namesPlacesState.search
      ? true
      : entry.searchText.includes(namesPlacesState.search.toLowerCase());

    return byType && bySearch;
  });

  const content = namesPlacesControls.content;
  const detail = namesPlacesControls.detail;
  if (!content) return;

  content.innerHTML = '';
  if (detail) {
    detail.innerHTML = '';
    detail.hidden = true;
  }

  if (!visible.length) {
    if (status.namesPlaces) {
      status.namesPlaces.textContent = 'No matching names or places found.';
    }
    return;
  }

  if (status.namesPlaces) {
    status.namesPlaces.textContent = `${visible.length} matching name/place entries.`;
  }

  visible.forEach((entry) => {
    const card = el('article', { className: 'page-card nameplace-entry', id: `np-${entry.id}` });
    card.appendChild(el('h3', { className: 'card-title', text: entry.displayName }));
    const referenceSummary = [];
    if (entry.sourcePages.length) {
      referenceSummary.push(`${entry.sourcePages.length} Book page reference${entry.sourcePages.length === 1 ? '' : 's'}`);
    }
    if (entry.correspondenceOccurrences?.length) {
      referenceSummary.push(`${entry.correspondenceOccurrences.length} correspondence reference${entry.correspondenceOccurrences.length === 1 ? '' : 's'}`);
    }
    card.appendChild(el('p', { className: 'meta', text: `${entry.kind} | ${referenceSummary.join(' | ')}` }));
    if (entry.locality || entry.county) {
      card.appendChild(el('p', { className: 'nameplace-summary', text: [entry.locality, entry.county].filter(Boolean).join(' | ') }));
    }
    if (entry.uncertainty) {
      card.appendChild(el('p', { className: 'uncertainty-note', text: 'Uncertain identification - visual source review requested.' }));
    }

    card.appendChild(el('button', {
      type: 'button',
      className: 'detail-close entry-button',
      text: 'Open entry',
      onClick: () => renderNamesPlacesDetail(entry),
    }));

    content.appendChild(card);
  });
}

function renderNamesPlacesDetail(entry) {
  const detail = namesPlacesControls.detail;
  if (!detail) return;
  detail.hidden = false;
  detail.innerHTML = '';

  const panel = el('article', { className: 'person-detail-card' });
  panel.appendChild(el('h3', { className: 'card-title', text: `${entry.displayName} (${entry.kind})` }));
  panel.appendChild(el('p', { className: 'meta', text: `${entry.type === 'person' ? 'Person' : 'Place / Property'}` }));

  if (entry.nameAsWritten && entry.nameAsWritten !== entry.displayName) {
    panel.appendChild(el('p', { className: 'meta', text: `As written: ${entry.nameAsWritten}` }));
  }

  if (entry.locality || entry.county) {
    panel.appendChild(el('p', { className: 'meta', text: [entry.locality, entry.county].filter(Boolean).join(' | ') }));
  }

  if (entry.englishGloss) {
    panel.appendChild(el('p', { className: 'meta', text: `English gloss in the book: ${entry.englishGloss}` }));
  }

  if (entry.notes) {
    panel.appendChild(el('p', { text: entry.notes }));
  }

  if (entry.uncertainty) {
    panel.appendChild(el('p', { className: 'uncertainty-note', text: entry.uncertaintyNote || 'The searchable text is uncertain. Confirm this entry against the page scan before editorial use.' }));
  }

  if (entry.variants?.length) {
    panel.appendChild(el('p', { className: 'meta', text: `Variants: ${entry.variants.join(', ')}` }));
  }

  if (entry.relationship) {
    panel.appendChild(el('p', { className: 'meta', text: entry.relationship }));
  }

  const sourcePages = entry.sourcePages || [];
  if (sourcePages.length) {
    const links = el('div', { className: 'section-links' });
    links.appendChild(el('span', { className: 'tag', text: 'Book pages' }));
    sourcePages.forEach((pageId) => {
      const page = findById(appState.data.bookPages, pageId);
      if (!page) return;
      links.appendChild(el('a', {
        className: 'link-chip',
        href: `#${pageId}`,
        text: `Book ${page.pageNumber}`,
        onClick: (eventObj) => {
          eventObj.preventDefault();
          focusPanel('book');
          openBookById(pageId);
        },
      }));
    });
    panel.appendChild(links);
  }

  if (entry.correspondenceOccurrences?.length) {
    const links = el('div', { className: 'section-links' });
    links.appendChild(el('span', { className: 'tag', text: 'Correspondence' }));
    entry.correspondenceOccurrences.forEach((occurrence) => {
      const letter = findById(appState.data.letters || [], occurrence.letterId);
      if (!letter) return;
      links.appendChild(el('a', {
        className: 'link-chip',
        href: `#${occurrence.sourcePageId}`,
        text: `${letter.dateDisplay}: ${letter.title}`,
        onClick: (eventObj) => {
          eventObj.preventDefault();
          openCorrespondenceItemById(letter.id);
        },
      }));
    });
    panel.appendChild(links);
  }

  if (entry.type === 'person' && entry.relatedPersonId) {
    panel.appendChild(
      el('button', {
        type: 'button',
        className: 'detail-close',
        text: 'Open person in Charts',
        onClick: () => {
          focusPanel('charts');
          const person = findById(appState.data.people, entry.relatedPersonId);
          if (person) renderPersonDetail(person, appState.data);
        },
      })
    );
  }

  panel.appendChild(
    el('button', {
      type: 'button',
      className: 'detail-close',
      text: 'Hide detail',
      onClick: () => (detail.hidden = true),
    })
  );
  detail.appendChild(panel);
}

function wireNamesPlacesControls() {
  if (!namesPlacesControls.search || !namesPlacesControls.filters.length) return;

  namesPlacesControls.filters.forEach((button) => {
    button.addEventListener('click', () => {
      namesPlacesControls.filters.forEach((btn) => btn.classList.remove('is-active'));
      button.classList.add('is-active');
      namesPlacesState.filter = button.dataset.filter;
      renderNamesPlacesContent();
    });
  });

  namesPlacesControls.search.addEventListener('input', (eventObj) => {
    namesPlacesState.search = eventObj.target.value;
    renderNamesPlacesContent();
  });
}
function renderPhotos() {
  const photos = appState.data.photos || [];
  if (!photos.length) return;

  const section = el('section', { className: 'content-panel' });
  section.appendChild(el('h3', { className: 'card-title', text: 'Photographs (DEMO)' }));
  const grid = el('div', { className: 'page-grid' });

  photos.forEach((photo) => {
    const card = el('article', { className: 'photo-card', id: `photo-${photo.id}` }, [
      el('h4', { className: 'card-title', text: photo.title }),
      el('div', { className: 'image-frame' }, [makeZoomImage(photo.image, photo.alt || 'Sample photo')]),
      el('p', { className: 'meta', text: photo.caption }),
      el('p', { className: 'meta', text: `ID: ${photo.id}` }),
    ]);
    grid.appendChild(card);
  });

  section.appendChild(grid);
  document.getElementById('sources-content').appendChild(section);
}

function flattenSearchIndex(data) {
  const index = [];

  const appendItems = (items = [], type) => {
    items.forEach((item) => {
      const resultType = typeof type === 'function' ? type(item) : type;
      const chunks = [
        item.id,
        item.title,
        item.name,
        item.nameAsWritten,
        item.displayName,
        item.displayType,
        item.notes,
        item.description,
        item.caption,
        item.transcription,
        item.primaryWriter,
        item.transcriptionStatus,
        item.originalLanguageTranscription,
        item.translation,
        item.summary,
        item.ocrText,
        item.relationship,
        item.locality,
        item.county,
        item.englishGloss,
        ...(item.variants || []),
        ...sourcePagesFor(item),
      ].filter(Boolean).join(' ');
      index.push({
        id: item.id,
        type: resultType,
        title: item.title || item.displayName || item.name || 'Untitled',
        text: chunks.toLowerCase(),
        snippet: item.summary || item.description || item.caption || item.notes || '',
        rawText: item.ocrText || (item.journalId ? item.transcription || '' : ''),
      });
    });
  };

  const appendJournalLayer = (item, layerLabel, layerText) => {
    const chunks = [
      item.id,
      item.title,
      item.journalTitle,
      item.sectionLabel,
      item.contentContext,
      item.notes,
      item.attributionBasis,
      layerText,
      ...(item.dates || []),
    ].filter(Boolean).join(' ');
    index.push({
      id: item.id,
      type: `Journal - ${layerLabel}`,
      title: item.title || `${item.journalTitle} - PDF page ${item.pdfPageNumber}`,
      text: chunks.toLowerCase(),
      snippet: item.contentContext || `${item.journalTitle}, PDF page ${item.pdfPageNumber}`,
      rawText: layerText || '',
    });
  };

  appendItems(data.events, 'Story Event');
  appendItems(data.bookPages, 'Original Book');
  appendItems(data.journals, 'Journal');
  (data.journalPages || []).forEach((page) => {
    if (page.welshTranscription != null) {
      appendJournalLayer(page, page.searchLayer || 'Welsh transcription', page.welshTranscription);
      const translation = (page.translation || '').trim();
      if (translation && !/^\[(Untranslated|Not applicable)/i.test(translation)) {
        appendJournalLayer(page, 'Modern English translation', translation);
      }
      return;
    }
    appendJournalLayer(page, page.searchLayer || 'English transcription', page.transcription || '');
  });
  appendItems(data.correspondenceCollections, 'Correspondence collection');
  (data.letters || []).forEach((item) => {
    index.push({
      id: item.id,
      type: 'Correspondence',
      title: item.title,
      text: item.searchText,
      snippet: ['Roberts Family Correspondence', correspondenceParticipantLabel(item), item.dateDisplay, item.pageLabel, item.origin].filter(Boolean).join(' • '),
      rawText: item.text || '',
    });
  });
  (data.correspondencePages || []).forEach((page) => {
    index.push({
      id: page.id,
      type: 'Correspondence page',
      title: `Roberts Family Correspondence - PDF page ${page.pdfPageNumber}`,
      text: `${page.id} correspondence page ${page.pdfPageNumber}`,
      snippet: `Supplied compilation PDF page ${page.pdfPageNumber}`,
      rawText: '',
    });
  });
  appendItems(data.sources, 'Source record');
  appendItems((data.people || []).filter((item) => item.indexScope === 'book-pages-001-068' || (item.sourceOccurrences || []).length), 'Person');
  appendItems((data.places || []).filter((item) => item.indexScope === 'book-pages-001-068' || (item.sourceOccurrences || []).length), (item) => item.displayType || 'Place');
  appendItems(data.editorialNotes, 'Editorial note');
  appendItems(data.photos, 'Photograph');

  return index;
}

function performSearch(query) {
  const normalized = (query || '').trim().toLowerCase();
  const resultsContainer = document.getElementById('search-results');
  resultsContainer.innerHTML = '';

  if (!normalized) {
    status.search.textContent = 'Type a word to search all entities and source-linked pages.';
    return;
  }

  const results = appState.searchIndex
    .filter((record) => record.text.includes(normalized))
    .slice(0, 40);

  status.search.textContent = `${results.length} result(s) for "${query}"`;
  if (!results.length) {
    resultsContainer.appendChild(el('p', { text: 'No matches found in demo data.' }));
    return;
  }

  results.forEach((result) => {
    const resultEl = el('article', { className: 'search-result' });
    const heading = el('h3', { className: 'card-title' });
    heading.appendChild(document.createTextNode(result.title));
    heading.appendChild(el('span', { className: 'source-type', text: result.type }));
    resultEl.appendChild(heading);
    resultEl.appendChild(el('p', { className: 'meta', text: `ID: ${result.id}` }));

    let snippet = result.snippet;
    if (result.rawText) {
      const lowerText = result.rawText.toLowerCase();
      const matchIndex = lowerText.indexOf(normalized);
      if (matchIndex >= 0) {
        const start = Math.max(0, matchIndex - 90);
        const end = Math.min(result.rawText.length, matchIndex + normalized.length + 140);
        snippet = `${start > 0 ? '...' : ''}${result.rawText.slice(start, end).replace(/\s+/g, ' ').trim()}${end < result.rawText.length ? '...' : ''}`;
      }
    }

    if (snippet) {
      resultEl.appendChild(el('p', { text: snippet }));
    }

    resultEl.appendChild(
      el('a', {
        className: 'link-chip',
        href: '#',
        text: 'Open related',
        onClick: (event) => {
          event.preventDefault();
          openBySearchType(result.type, result.id, query);
        },
      })
    );

    resultsContainer.appendChild(resultEl);
  });
}

function openBySearchType(type, id, query = '') {
  const indexedEntry = namesPlacesState.entries.find((entry) => entry.id === id);
  if (indexedEntry) {
    focusPanel('names-places');
    renderNamesPlacesDetail(indexedEntry);
    document.getElementById(`np-${id}`)?.scrollIntoView({ block: 'nearest' });
    return;
  }

  if (findById(appState.data?.journalPages || [], id)) {
    openJournalPageById(id, query);
    return;
  }

  if (findById(appState.data?.letters || [], id)) {
    openCorrespondenceItemById(id);
    return;
  }

  if (findById(appState.data?.correspondencePages || [], id)) {
    openCorrespondencePageById(id);
    return;
  }

  const map = {
    'Story Event': 'story',
    'Original Book': 'book',
    'Journal': 'journals',
    'Journal page': 'journals',
    'Correspondence': 'sources',
    'Correspondence page': 'sources',
    'Correspondence collection': 'sources',
    'Source record': 'sources',
    'Person': 'charts',
    'Place': 'names-places',
    'Home / Property': 'names-places',
    'Editorial note': 'search',
    'Photograph': 'sources',
  };
  focusPanel(map[type] || 'search');
  if (type === 'Person') {
    const person = findById(appState.data.people, id);
    if (person) {
      renderPersonDetail(person, appState.data);
    }
    return;
  }
  if (type === 'Original Book') {
    openBookById(id);
    return;
  }
  document.getElementById('search-input').value = id;
  performSearch(id);
}

function navigateSearchTo(term) {
  const input = document.getElementById('search-input');
  input.value = term;
  performSearch(term);
}

function focusPanel(sectionId) {
  panelButtons.forEach((button) => {
    const isActive = button.dataset.section === sectionId;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });
  panels.forEach((panel) => (panel.hidden = panel.id !== sectionId));
}

function wireNavigation() {
  panelButtons.forEach((button) => {
    button.addEventListener('click', () => focusPanel(button.dataset.section));
  });

  document.getElementById('search-input').addEventListener('input', (event) => {
    performSearch(event.target.value);
  });

  wireNamesPlacesControls();


  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace(/^#/, '');
    if (panels.some((panel) => panel.id === hash)) {
      focusPanel(hash);
      return;
    }
    const index = bookIndexFromId(hash);
    if (index >= 0) {
      focusPanel('book');
      renderCurrentBookPage(index, false);
      return;
    }
    openJournalPageById(hash, false);
    if (findById(appState.data?.correspondencePages || [], hash)) {
      openCorrespondencePageById(hash, false);
    }
  });

  wireBookControls();
  focusPanel('story');
}

function renderBookProvenance(data) {
  const host = document.getElementById('book-provenance');
  if (!host) return;
  host.innerHTML = '';
  const book = (data.books || []).find((item) => item.id === 'book-roberts-remembrance') || data.books?.[0];
  if (!book?.compiler) return;

  const card = el('article', { className: 'book-provenance-card' });
  card.appendChild(el('p', { className: 'eyebrow', text: 'Historical compilation context' }));
  card.appendChild(el('h3', { className: 'card-title', text: 'Original compilation and modern editorial layer' }));
  card.appendChild(el('p', { className: 'meta', text: `Compiler: ${book.compiler}${book.compilerAliases?.length ? ` (also known as ${book.compilerAliases.join(', ')})` : ''}` }));
  if (book.originalCompilationNote) {
    card.appendChild(el('p', { text: book.originalCompilationNote }));
  }

  const context = book.historicalContext;
  if (context) {
    const contextBlock = el('div', { className: 'book-provenance-context' });
    contextBlock.appendChild(el('h4', { className: 'reader-heading', text: 'Historical context' }));
    [context.welshLanguage, context.travel, context.researchImplication]
      .filter(Boolean)
      .forEach((statement) => contextBlock.appendChild(el('p', { text: statement })));
    card.appendChild(contextBlock);
  }

  if (book.editionLayers?.length) {
    const layers = el('div', { className: 'book-edition-layers' });
    book.editionLayers.forEach((layer) => {
      layers.appendChild(el('section', { className: 'book-edition-layer' }, [
        el('h4', { className: 'reader-heading', text: layer.label }),
        el('p', { text: layer.description }),
      ]));
    });
    card.appendChild(layers);
  }
  host.appendChild(card);
}

function render(data) {
  appState.data = data;
  namesPlacesState.entries = buildNamesPlacesEntries(data);
  appState.searchIndex = flattenSearchIndex(data);

  const storyContainer = document.getElementById('story-content');
  data.events && sortedByDate(data.events).forEach((event) => storyContainer.appendChild(renderEvent(event, data)));

  renderBookProvenance(data);

  const pages = getBookPages();
  appState.bookState.pages = pages;
  appState.bookState.activeIndex = 0;
  bookControls.input.max = String(pages.length || 1);
  bookControls.total.textContent = `/ ${pages.length || 0}`;

  const hash = window.location.hash.replace(/^#/, '');
  if (panels.some((panel) => panel.id === hash)) focusPanel(hash);
  const startIndex = bookIndexFromId(hash);
  if (pages.length) {
    if (startIndex >= 0) {
      renderCurrentBookPage(startIndex, true);
    } else {
      renderCurrentBookPage(0, false);
    }
  } else {
    bookControls.viewer.innerHTML = '';
    status.book.textContent = 'No book pages found in the source dataset.';
  }

  const journalContainer = document.getElementById('journals-content');
  journalContainer.innerHTML = '';
  appState.journalReaders.clear();
  data.journals?.forEach((journal) => journalContainer.appendChild(renderJournal(journal, data)));
  if (findById(data.journalPages || [], hash)) openJournalPageById(hash, false);

  const sourceContainer = document.getElementById('sources-content');
  sourceContainer.innerHTML = '';
  renderCorrespondence(data);
  const correspondenceHash = window.location.hash.slice(1);
  if (findById(data.correspondencePages || [], correspondenceHash)) {
    openCorrespondencePageById(correspondenceHash, false);
  }
  data.sources?.forEach((source) => sourceContainer.appendChild(renderSource(source)));
  renderPhotos();
  renderNamesPlacesContent();
  renderFamily(data);

  status.story.textContent = `${data.events?.length || 0} sample event loaded.`;
  const reviewedPages = (data.journalPages || []).filter((page) => page.transcriptionStatus === 'reviewed').length;
  const startedPages = (data.journalPages || []).filter(journalPageIsStarted).length;
  const journalCount = data.journals?.length || 0;
  status.journals.textContent = `${journalCount} journals | ${startedPages} pages with transcription text | ${reviewedPages} reviewed.`;
  status.sources.textContent = `${data.sources?.length || 0} evidence records and ${data.letters?.length || 0} correspondence items loaded.`;
  status.family.textContent = status.family.textContent || 'Family lineage loaded from data.';
  status.search.textContent = 'Type a word to search all entities and source-linked pages.';
}

async function init() {
  wireNavigation();
  try {
    const paths = ['data/site-data.json', 'data/book-text.json', 'data/people.json', 'data/places.json', 'data/journals/rdr/journal-data.json', 'data/journals/dr/journal-data.json', 'data/correspondence/correspondence-data.json', 'data/provenance.json'];
    const responses = await Promise.all(paths.map((path) => fetch(path)));
    responses.forEach((response, index) => {
      if (!response.ok) throw new Error(`Unable to load ${paths[index]} (${response.status})`);
    });
    const [data, bookText, peopleData, placesData, rdrJournalData, drJournalData, correspondenceData, provenanceData] = await Promise.all(responses.map((response) => response.json()));
    const textByPageId = new Map((bookText.pages || []).map((page) => [page.id, page.ocrText || '']));
    data.bookPages = (data.bookPages || []).map((page) => ({ ...page, ocrText: textByPageId.get(page.id) || '' }));
    data.people = mergeById(data.people || [], peopleData.people || []);
    data.people = mergeById(data.people, correspondenceData.people || []);
    data.people = mergeById(data.people, provenanceData.people || []);
    data.places = mergeById(data.places || [], placesData.places || []);
    data.places = mergeById(data.places, correspondenceData.places || []);
    data.journals = [...(rdrJournalData.journals || []), ...(drJournalData.journals || [])];
    data.journalPages = [...(rdrJournalData.journalPages || []), ...(drJournalData.journalPages || [])];
    data.correspondenceCollections = correspondenceData.correspondenceCollections || [];
    data.correspondencePages = correspondenceData.correspondencePages || [];
    data.letters = correspondenceData.letters || [];
    data.books = mergeById(data.books || [], provenanceData.books || []);
    data.sources = mergeById(data.sources || [], provenanceData.sources || []);
    data.genealogy = { ...(data.genealogy || {}), ...(provenanceData.genealogy || {}) };
    data.provenance = provenanceData;
    render(data);
  } catch (error) {
    console.error(error);
    const msg = 'A required structured data file failed to load. Serve the repository through a local web server or GitHub Pages.';
    status.story.textContent = msg;
    status.book.textContent = msg;
    status.journals.textContent = msg;
    status.sources.textContent = msg;
    status.family.textContent = msg;
    if (status.namesPlaces) status.namesPlaces.textContent = msg;
    status.search.textContent = msg;
  }
}

init();









