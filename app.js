const appState = {
  data: null,
  bookState: { pages: [], activeIndex: 0 },
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
    .filter((person) => person.indexScope === 'book-pages-001-068' && sourcePagesFor(person).length)
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
    searchText: [person.name, person.nameAsWritten, person.displayName, person.relationship, person.locality, person.county, ...(person.variants || []), ...sourcePagesFor(person)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  }));

  const places = (data.places || [])
    .filter((place) => place.indexScope === 'book-pages-001-068' && sourcePagesFor(place).length)
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
      searchText: [place.name, place.nameAsWritten, place.displayName, place.displayType, place.locality, place.county, place.englishGloss, ...(place.variants || []), ...sourcePagesFor(place)]
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
    card.appendChild(el('p', { className: 'meta', text: `${entry.kind} | ${entry.sourcePages.length} Book page reference${entry.sourcePages.length === 1 ? '' : 's'}` }));
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
        rawText: item.ocrText || '',
      });
    });
  };

  appendItems(data.events, 'Story Event');
  appendItems(data.bookPages, 'Original Book');
  appendItems(data.journals, 'Journal');
  appendItems(data.journalPages, 'Journal page');
  appendItems(data.sources, 'Source record');
  appendItems((data.people || []).filter((item) => item.indexScope === 'book-pages-001-068'), 'Person');
  appendItems((data.places || []).filter((item) => item.indexScope === 'book-pages-001-068'), (item) => item.displayType || 'Place');
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
          openBySearchType(result.type, result.id);
        },
      })
    );

    resultsContainer.appendChild(resultEl);
  });
}

function openBySearchType(type, id) {
  const indexedEntry = namesPlacesState.entries.find((entry) => entry.id === id);
  if (indexedEntry) {
    focusPanel('names-places');
    renderNamesPlacesDetail(indexedEntry);
    document.getElementById(`np-${id}`)?.scrollIntoView({ block: 'nearest' });
    return;
  }

  const map = {
    'Story Event': 'story',
    'Original Book': 'book',
    'Journal': 'journals',
    'Journal page': 'journals',
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
    const index = bookIndexFromId(hash);
    if (index >= 0) {
      focusPanel('book');
      renderCurrentBookPage(index, false);
    }
  });

  wireBookControls();
  focusPanel('story');
}

function render(data) {
  appState.data = data;
  namesPlacesState.entries = buildNamesPlacesEntries(data);
  appState.searchIndex = flattenSearchIndex(data);

  const storyContainer = document.getElementById('story-content');
  data.events && sortedByDate(data.events).forEach((event) => storyContainer.appendChild(renderEvent(event, data)));

  const pages = getBookPages();
  appState.bookState.pages = pages;
  appState.bookState.activeIndex = 0;
  bookControls.input.max = String(pages.length || 1);
  bookControls.total.textContent = `/ ${pages.length || 0}`;

  const hash = window.location.hash.replace(/^#/, '');
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
  data.journals?.forEach((journal) => journalContainer.appendChild(renderJournal(journal, data)));

  const sourceContainer = document.getElementById('sources-content');
  data.sources?.forEach((source) => sourceContainer.appendChild(renderSource(source)));
  renderPhotos();
  renderNamesPlacesContent();
  renderFamily(data);

  status.story.textContent = `${data.events?.length || 0} sample event loaded.`;
  status.journals.textContent = `${data.journals?.length || 0} journal(s) loaded with ${data.journalPages?.length || 0} pages.`;
  status.sources.textContent = `${data.sources?.length || 0} evidence records loaded.`;
  status.family.textContent = status.family.textContent || 'Family lineage loaded from data.';
  status.search.textContent = 'Type a word to search all entities and source-linked pages.';
}

async function init() {
  wireNavigation();
  try {
    const paths = ['data/site-data.json', 'data/book-text.json', 'data/people.json', 'data/places.json'];
    const responses = await Promise.all(paths.map((path) => fetch(path)));
    responses.forEach((response, index) => {
      if (!response.ok) throw new Error(`Unable to load ${paths[index]} (${response.status})`);
    });
    const [data, bookText, peopleData, placesData] = await Promise.all(responses.map((response) => response.json()));
    const textByPageId = new Map((bookText.pages || []).map((page) => [page.id, page.ocrText || '']));
    data.bookPages = (data.bookPages || []).map((page) => ({ ...page, ocrText: textByPageId.get(page.id) || '' }));
    data.people = mergeById(data.people || [], peopleData.people || []);
    data.places = mergeById(data.places || [], placesData.places || []);
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









