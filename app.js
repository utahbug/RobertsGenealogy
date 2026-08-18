const appState = {
  data: null,
};

const panelButtons = [...document.querySelectorAll('.nav-button')];
const panels = [...document.querySelectorAll('.content-panel')];

const status = {
  story: document.getElementById('story-status'),
  book: document.getElementById('book-status'),
  journals: document.getElementById('journals-status'),
  sources: document.getElementById('sources-status'),
  search: document.getElementById('search-status'),
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
      node.addEventListener(key.slice(2), value);
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

function sortedByDate(items) {
  return [...items].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
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
        } else if (type === 'journal') {
          focusPanel('journals');
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

function renderBookPage(page) {
  const card = el('article', { className: 'page-card', id: `book-page-${page.id}` });
  card.appendChild(el('h3', { className: 'card-title', text: `Book page ${page.pageNumber} · ${page.title} (DEMO)` }));
  card.appendChild(el('p', { className: 'meta', text: `${page.bookId} • ${page.sourceType}` }));

  const frame = el('div', { className: 'image-frame' }, [makeZoomImage(page.image, page.caption || 'Sample book page image')]);
  card.appendChild(frame);
  card.appendChild(el('p', { text: page.caption || 'No caption provided.' }));

  if (page.linkedEvents?.length) {
    const row = buildLinks(page.linkedEvents, 'story', 'Linked event', appState.data.events, (e) => e.title);
    card.appendChild(row);
  }

  return card;
}

function renderJournal(journal, data) {
  const card = el('article', { className: 'journal-card' });
  card.appendChild(el('h3', { className: 'card-title', text: `${journal.title} (DEMO)` }));
  card.appendChild(el('p', { className: 'meta', text: `${journal.owner || 'Sample repository'} • ${journal.location || 'Unknown'} • ${journal.dateRange || 'Date unknown'}` }));

  if (journal.description) {
    card.appendChild(el('p', { text: journal.description }));
  }

  const pages = data.journalPages
    .filter((p) => p.journalId === journal.id)
    .sort((a, b) => (Number(a.pageNumber) || 0) - (Number(b.pageNumber) || 0));

  pages.forEach((page) => {
    const panel = el('section', { className: 'event-card' });
    panel.appendChild(el('h4', { className: 'card-title', text: `Page ${page.pageNumber}` }));
    panel.appendChild(el('p', { className: 'meta', text: `Journal page ${page.pageNumber} (DEMO)` }));

    const reader = el('div', { className: 'journal-reader' });
    reader.appendChild(el('div', { className: 'image-frame' }, [makeZoomImage(page.image, `Sample journal page ${page.pageNumber}`)]));

    const textColumn = el('div', { className: 'reader-text' });
    textColumn.appendChild(el('p', { text: `Transcription: ${page.transcription || 'Transcription sample pending.'}` }));
    if (page.originalLanguageTranscription) {
      textColumn.appendChild(el('p', { text: `Original language: ${page.originalLanguageTranscription}` }));
    }
    if (page.translation) {
      textColumn.appendChild(el('p', { text: `English translation: ${page.translation}` }));
    }
    if (page.notes) {
      textColumn.appendChild(el('p', { className: 'meta', text: `Notes: ${page.notes}` }));
    }

    const people = (page.people || [])
      .map((id) => findById(data.people, id))
      .filter(Boolean);
    const places = (page.places || [])
      .map((id) => findById(data.places, id))
      .filter(Boolean);

    const peopleRow = buildTagRow(people, 'People', (person) => person.name);
    if (peopleRow) textColumn.appendChild(peopleRow);

    const placeRow = buildTagRow(places, 'Places', (place) => place.name);
    if (placeRow) textColumn.appendChild(placeRow);

    const dateRow = buildTagRow(page.dates || [], 'Dates', (value) => value);
    if (dateRow) textColumn.appendChild(dateRow);

    textColumn.appendChild(buildLinks(page.linkedEvents || [], 'story', 'Linked events', data.events, (e) => e.title));
    reader.appendChild(textColumn);

    panel.appendChild(reader);
    card.appendChild(panel);
  });

  return card;
}

function renderSource(source) {
  const card = el('article', { className: 'source-card', id: `source-${source.id}` });
  card.appendChild(el('h3', { className: 'card-title', text: `${source.title} (DEMO)` }));
  card.appendChild(el('p', { className: 'meta', text: `${source.type} • ${source.date || 'date not set'}` }));
  card.appendChild(el('p', { text: source.description || 'No description available.' }));
  if (source.location) card.appendChild(el('p', { className: 'meta', text: `Repository: ${source.location}` }));
  if (source.citation) card.appendChild(el('p', { className: 'meta', text: `Citation: ${source.citation}` }));

  if (source.supports?.length) {
    card.appendChild(buildLinks(source.supports, 'story', 'Supports', appState.data.events, (e) => e.title));
  }

  return card;
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

  const appendItems = (items, type) => {
    items.forEach((item) => {
      const chunks = [
        item.id,
        item.title,
        item.name,
        item.notes,
        item.description,
        item.caption,
        item.transcription,
        item.originalLanguageTranscription,
        item.translation,
        item.summary,
        item.ocrText,
      ].filter(Boolean).join(' ');
      index.push({
        id: item.id,
        type,
        title: item.title || item.name || 'Untitled',
        text: chunks.toLowerCase(),
        snippet: item.summary || item.description || item.caption || item.notes || '',
      });
    });
  };

  appendItems(data.events, 'Story Event');
  appendItems(data.bookPages, 'Book page');
  appendItems(data.journals, 'Journal');
  appendItems(data.journalPages, 'Journal page');
  appendItems(data.sources, 'Source record');
  appendItems(data.people, 'Person');
  appendItems(data.places, 'Place');
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

    if (result.snippet) {
      resultEl.appendChild(el('p', { text: result.snippet }));
    }

    resultEl.appendChild(
      el('a', {
        className: 'link-chip',
        href: '#',
        text: 'Open related',
        onClick: (event) => {
          event.preventDefault();
          openBySearchType(result.type, result.id);
        },
      })
    );

    resultsContainer.appendChild(resultEl);
  });
}

function openBySearchType(type, id) {
  const map = {
    'Story Event': 'story',
    'Book page': 'book',
    'Journal': 'journals',
    'Journal page': 'journals',
    'Source record': 'sources',
    'Person': 'search',
    'Place': 'search',
    'Editorial note': 'search',
    'Photograph': 'sources',
  };
  focusPanel(map[type] || 'search');
  document.getElementById('search-input').value = id;
  performSearch(id);
}

function navigateSearchTo(term) {
  const input = document.getElementById('search-input');
  input.value = term;
  performSearch(term);
}

function focusPanel(sectionId) {
  panelButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.section === sectionId));
  panels.forEach((panel) => (panel.hidden = panel.id !== sectionId));
}

function wireNavigation() {
  panelButtons.forEach((button) => {
    button.addEventListener('click', () => focusPanel(button.dataset.section));
  });

  document.getElementById('search-input').addEventListener('input', (event) => {
    performSearch(event.target.value);
  });

  focusPanel('story');
}

function render(data) {
  appState.data = data;
  appState.searchIndex = flattenSearchIndex(data);

  const storyContainer = document.getElementById('story-content');
  data.events && sortedByDate(data.events).forEach((event) => storyContainer.appendChild(renderEvent(event, data)));

  const bookContainer = document.getElementById('book-content');
  data.bookPages?.forEach((page) => bookContainer.appendChild(renderBookPage(page)));

  const journalContainer = document.getElementById('journals-content');
  data.journals?.forEach((journal) => journalContainer.appendChild(renderJournal(journal, data)));

  const sourceContainer = document.getElementById('sources-content');
  data.sources?.forEach((source) => sourceContainer.appendChild(renderSource(source)));
  renderPhotos();

  status.story.textContent = `${data.events?.length || 0} sample event loaded.`;
  status.book.textContent = `${data.bookPages?.length || 0} sample book pages loaded.`;
  status.journals.textContent = `${data.journals?.length || 0} journal(s) loaded with ${data.journalPages?.length || 0} pages.`;
  status.sources.textContent = `${data.sources?.length || 0} evidence records loaded.`;
  status.search.textContent = 'Type a word to search all entities and source-linked pages.';
}

async function init() {
  wireNavigation();
  try {
    const response = await fetch('data/site-data.json');
    const data = await response.json();
    render(data);
  } catch (error) {
    console.error(error);
    const msg = 'Data file failed to load. This demo expects data/site-data.json to be accessible.';
    status.story.textContent = msg;
    status.book.textContent = msg;
    status.journals.textContent = msg;
    status.sources.textContent = msg;
    status.search.textContent = msg;
  }
}

init();
