const PAGE_SIZE = 24;
const MOBILE_MAX = 768;
const COMPARE_MIN = 2;
const COMPARE_MAX = 4;
const COMPARE_STORAGE_KEY = 'laptopFinder_compare';

const filterDefs = [
  {
    label: 'Price Range',
    key: 'priceRange',
    type: 'single',
    options: ['Under $500', '$500–$999', '$1000–$1499', '$1500–$1999', '$2000+'],
  },
  { label: 'Brand', key: 'brand', type: 'single', options: ['Apple', 'Dell', 'HP', 'Lenovo', 'ASUS', 'Acer', 'MSI', 'Razer', 'Microsoft', 'Samsung', 'Alienware'] },
  { label: 'Laptop Type', key: 'type', type: 'single', options: ['Ultrabook', 'Gaming', 'Business', 'Student', '2-in-1', 'Workstation', 'Chromebook'] },
  { label: 'Operating System', key: 'os', type: 'single', options: ['Windows 11', 'macOS', 'Chrome OS'] },
  { label: 'Processor', key: 'processor', type: 'single', options: [
      'Intel Core i5', 'Intel Core i7', 'Intel Core i9',
      'Intel Core Ultra 5', 'Intel Core Ultra 7', 'Intel Core Ultra 9',
      'AMD Ryzen 3', 'AMD Ryzen 5', 'AMD Ryzen 7', 'AMD Ryzen 9', 'Apple M3', 'Apple M4',
    ],
  },
  { label: 'RAM', key: 'ram', type: 'single', options: ['8GB', '16GB', '32GB', '64GB'] },
  { label: 'Storage', key: 'storage', type: 'single', options: ['128GB', '256GB', '512GB', '1TB', '2TB'] },
  { label: 'Storage Type', key: 'storageType', type: 'single', options: ['SSD', 'HDD', 'SSD+HDD'] },
  { label: 'GPU', key: 'gpuCategory', type: 'single', options: ['Integrated', 'NVIDIA RTX 4000', 'NVIDIA RTX 3000', 'NVIDIA GTX', 'AMD Radeon'] },
  { label: 'Screen Size', key: 'screenSizeRange', type: 'single', options: ['11"–12"', '13"–14"', '15"–16"', '17"+'] },
  { label: 'Panel Type', key: 'panelType', type: 'single', options: ['IPS', 'OLED', 'AMOLED'] },
  { label: 'Resolution', key: 'resolution', type: 'single', options: ['FHD', 'QHD', '4K UHD'] },
  { label: 'Refresh Rate', key: 'refreshRate', type: 'single', options: ['60Hz', '90Hz', '120Hz', '144Hz', '165Hz', '240Hz', '360Hz'] },
  { label: 'Battery Life', key: 'batteryLife', type: 'single', options: ['Up to 8hrs', '8–12hrs', '12hrs+'] },
  { label: 'Weight', key: 'weightRange', type: 'single', options: ['Under 2 lbs', '2–3 lbs', '3–4 lbs', '4+ lbs'] },
  { label: 'Ports', key: 'ports', type: 'array', options: ['USB-A', 'USB-C', 'Thunderbolt 4', 'HDMI', 'DisplayPort', 'SD Card', 'Ethernet', 'Audio Jack'] },
  { label: 'Features', key: 'features', type: 'array', options: ['Touchscreen', 'Backlit Keyboard', 'Fingerprint Reader', 'Face Recognition', 'Numeric Keypad', 'Webcam', 'Bluetooth', 'Wi-Fi 6', 'Wi-Fi 7'] },
  { label: 'Color', key: 'color', type: 'single', options: ['Silver', 'Black', 'Gray', 'White', 'Blue', 'Gold', 'Other'] },
  { label: 'Condition', key: 'condition', type: 'single', options: ['New', 'Refurbished', 'Open Box'] },
];

let laptops = [];
let filterState = {};
let appliedFilters = {};
let customChips = [];
let searchQuery = '';
let currentSort = 'default';
let visibleCount = PAGE_SIZE;
let filteredResults = [];
let priceModal = null;
let compareModal = null;
let compareIds = [];

const CSV_LIST_FIELDS = new Set(['ports', 'features']);
const CSV_NUM_FIELDS = new Set(['id', 'price']);

function getPriceRange(price) {
  if (price < 500)  return 'Under $500';
  if (price < 1000) return '$500–$999';
  if (price < 1500) return '$1000–$1499';
  if (price < 2000) return '$1500–$1999';
  return '$2000+';
}

function catalogBaseUrl() {
  const script = document.querySelector('script[src*="app.js"]');
  if (script?.src) return new URL('.', script.src);
  return new URL('.', window.location.href);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || (c === '\r' && input[i + 1] === '\n')) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      if (c === '\r') i++;
    } else if (c === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function csvToLaptops(text) {
  const rows = parseCsv(text.trim());
  if (!rows.length) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row) => {
    const rec = {};
    headers.forEach((header, i) => {
      let val = (row[i] ?? '').trim();
      if (CSV_LIST_FIELDS.has(header)) {
        rec[header] = val ? val.split('|').map((s) => s.trim()).filter(Boolean) : [];
      } else if (CSV_NUM_FIELDS.has(header)) {
        rec[header] = Number(val);
      } else {
        rec[header] = val;
      }
    });
    return { ...rec, priceRange: getPriceRange(rec.price) };
  });
}

async function tryFetchCsv() {
  const bases = [new URL('.', window.location.href), catalogBaseUrl()];
  const seen = new Set();

  for (const base of bases) {
    const url = new URL('laptops.csv', base).href;
    if (seen.has(url)) continue;
    seen.add(url);

    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const rows = csvToLaptops(await res.text());
      if (rows.length) return rows;
    } catch (_) {}
  }

  return null;
}

async function loadLaptops() {
  return tryFetchCsv();
}

function showCatalogError() {
  const countEl = el('results-count');
  const noResults = el('no-results');
  const loadMoreWrap = el('load-more-wrap');
  const clearBtn = el('no-results-clear');

  if (countEl) countEl.textContent = '';
  if (loadMoreWrap) loadMoreWrap.style.display = 'none';
  if (noResults) {
    const title = noResults.querySelector('.no-results-title');
    const sub = noResults.querySelector('.no-results-sub');
    if (title) title.textContent = "Couldn't load laptops";
    if (sub) {
      sub.textContent = window.location.protocol === 'file:'
        ? 'Run python -m http.server 5500 here, then open http://localhost:5500'
        : 'Check that laptops.csv is in the project folder.';
    }
    if (clearBtn) clearBtn.hidden = true;
    noResults.classList.add('visible');
  }
}

function startApp(rows) {
  laptops = rows;
  filteredResults = laptops.slice();
  const clearBtn = el('no-results-clear');
  if (clearBtn) clearBtn.hidden = false;
  loadCompareIds();
  initFilterState();
  renderFilterPanel();
  runFilter();
  updateSearchClearVisibility();
  renderCompareTray();
}

const RETAILERS = [
  { name: 'Amazon', color: '#E47911', bg: '#FFF8EF', search: 'https://www.amazon.com/s?k=' },
  { name: 'Best Buy', color: '#003884', bg: '#EEF3FF', search: 'https://www.bestbuy.com/site/searchpage.jsp?st=' },
  { name: 'Walmart', color: '#0071CE', bg: '#EFF8FF', search: 'https://www.walmart.com/search?q=' },
  { name: 'Newegg', color: '#EE4A1B', bg: '#FFF2EE', search: 'https://www.newegg.com/p/pl?d=' },
];

function el(id) {
  return document.getElementById(id);
}

function seededRandom(seed) {
  const x = Math.sin(seed + 1) * 1e4;
  return x - Math.floor(x);
}

function getMsrp(price) {
  return Math.round(price * 1.18 / 10) * 10;
}

function buildSearchTerm(name) {
  return name
    .replace(/"/g, ' inch')
    .replace(/[–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRetailerPrices(laptop) {
  const msrp = getMsrp(laptop.price);
  const cleaned = buildSearchTerm(laptop.name);
  const amazonTerm = cleaned.replace(/\s+/g, '+');
  const standardTerm = encodeURIComponent(cleaned);
  return RETAILERS.map((store, i) => {
    const seed = laptop.id * 17 + i * 31;
    const factor = 0.85 + seededRandom(seed) * 0.20;
    const price = Math.round(laptop.price * factor / 5) * 5;
    const savings = msrp - price;
    const term = store.name === 'Amazon' ? amazonTerm : standardTerm;
    const url = store.search + term;
    return { ...store, price, savings, url };
  });
}

function getBestRetailerPrice(laptop) {
  const rows = getRetailerPrices(laptop);
  return Math.min(...rows.map((row) => row.price));
}

function buildSearchText(laptop) {
  return [
    laptop.name,
    laptop.brand,
    laptop.type,
    laptop.processor,
    laptop.gpuName,
    laptop.gpuCategory,
    laptop.panelType,
    laptop.resolution,
    laptop.refreshRate,
    laptop.os,
    laptop.screenSizeRange,
    laptop.screenSizeRange ? laptop.screenSizeRange.replace(/"/g, ' inch') : '',
    laptop.batteryLife,
    laptop.weightRange,
    laptop.colorDisplay,
    laptop.condition,
    laptop.ram,
    laptop.storage,
    ...laptop.features,
    ...laptop.ports,
  ].join(' ').toLowerCase();
}

function normalizeKeyword(s) {
  return String(s)
    .toLowerCase()
    .replace(/\u2013|\u2014|\u2212/g, '-')
    .replace(/"/g, ' inch ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\d+)\s*-\s*(\d+)/g, '$1-$2');
}

function keywordTextFor(laptop) {
  let text = normalizeKeyword(buildSearchText(laptop));
  const sr = laptop.screenSizeRange;
  if (sr) {
    const noQuotes = sr.replace(/"/g, '');
    const dashNorm = noQuotes.replace(/\u2013|\u2014|\u2212/g, '-');
    text += ' ' + normalizeKeyword(dashNorm);
    const compact = dashNorm.replace(/\s+/g, '');
    if (compact) text += ' ' + compact;
  }
  return text;
}

function laptopMatchesKeyword(laptop, chipText) {
  return keywordTextFor(laptop).includes(normalizeKeyword(chipText));
}

function initFilterState() {
  filterState = {};
  for (const cat of filterDefs) {
    filterState[cat.label] = {};
    for (const opt of cat.options) {
      filterState[cat.label][opt] = 0;
    }
  }
  appliedFilters = JSON.parse(JSON.stringify(filterState));
}

function renderFilterPanel() {
  const container = el('filter-categories');
  container.innerHTML = '';

  filterDefs.forEach((cat, index) => {
    const section = document.createElement('div');
    section.className = index >= 4 ? 'filter-category collapsed' : 'filter-category';
    section.dataset.category = cat.label;

    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = `<span class="category-title">${cat.label}</span><span class="category-arrow">▾</span>`;
    header.addEventListener('click', () => toggleCategory(cat.label));

    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'category-options';
    optionsWrap.id = `opts-${cat.label.replace(/\s+/g, '-')}`;

    cat.options.forEach(opt => {
      const row = document.createElement('div');
      row.className = 'filter-option';
      row.addEventListener('click', () => cycleCheckbox(cat.label, opt));

      const box = document.createElement('div');
      box.className = 'tri-checkbox';
      box.dataset.state = filterState[cat.label][opt];
      box.id = `cb-${cat.label}-${opt}`.replace(/\s+/g, '_');
      box.textContent = getCheckboxIcon(filterState[cat.label][opt]);

      const label = document.createElement('span');
      label.className = 'option-label';
      label.textContent = opt;

      row.appendChild(box);
      row.appendChild(label);
      optionsWrap.appendChild(row);
    });

    section.appendChild(header);
    section.appendChild(optionsWrap);
    container.appendChild(section);
  });
}

function getCheckboxIcon(state) {
  if (state === 1) return '✓';
  if (state === 2) return '✗';
  return '';
}

function toggleCategory(label) {
  const section = document.querySelector(`.filter-category[data-category="${label}"]`);
  if (section) section.classList.toggle('collapsed');
}

function cycleCheckbox(categoryLabel, option) {
  const current = filterState[categoryLabel][option];
  filterState[categoryLabel][option] = (current + 1) % 3;

  const cbId = `cb-${categoryLabel}-${option}`.replace(/\s+/g, '_');
  const box = document.getElementById(cbId);
  if (box) {
    const next = filterState[categoryLabel][option];
    box.dataset.state = next;
    box.textContent = getCheckboxIcon(next);
  }
}

function renderChips() {
  const wrap = el('chips-wrap');
  wrap.innerHTML = '';

  customChips.forEach((chip, index) => {
    const chipEl = document.createElement('div');
    chipEl.className = `chip ${chip.type}`;
    chipEl.title = 'Toggle include / exclude';

    const typeLabel = document.createElement('span');
    typeLabel.className = 'chip-type';
    typeLabel.textContent = chip.type === 'include' ? '✓' : '✗';

    const labelEl = document.createElement('span');
    labelEl.className = 'chip-label';
    labelEl.textContent = chip.text;

    const removeEl = document.createElement('span');
    removeEl.className = 'chip-remove';
    removeEl.textContent = '×';
    removeEl.title = 'Remove';
    removeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      customChips.splice(index, 1);
      renderChips();
      runFilter();
    });

    chipEl.addEventListener('click', () => {
      customChips[index].type = chip.type === 'include' ? 'exclude' : 'include';
      renderChips();
      runFilter();
    });

    chipEl.appendChild(typeLabel);
    chipEl.appendChild(labelEl);
    chipEl.appendChild(removeEl);
    wrap.appendChild(chipEl);
  });
}

function renderResults() {
  const grid = el('results-grid');
  const noResults = el('no-results');
  const loadMoreWrap = el('load-more-wrap');
  const countEl = el('results-count');

  grid.innerHTML = '';

  if (filteredResults.length === 0) {
    const title = noResults.querySelector('.no-results-title');
    const sub = noResults.querySelector('.no-results-sub');
    if (title) title.textContent = 'Nothing matched';
    if (sub) sub.textContent = 'Try clearing a filter or two.';
    const clearBtn = el('no-results-clear');
    if (clearBtn) clearBtn.hidden = false;
    noResults.classList.add('visible');
    loadMoreWrap.style.display = 'none';
    countEl.textContent = 'No laptops found';
    return;
  }

  noResults.classList.remove('visible');
  const toShow = filteredResults.slice(0, visibleCount);
  for (let i = 0; i < toShow.length; i++) {
    grid.appendChild(buildCard(toShow[i]));
  }

  countEl.textContent = `Showing ${toShow.length} of ${filteredResults.length} laptop${filteredResults.length !== 1 ? 's' : ''}`;

  if (filteredResults.length > visibleCount) {
    loadMoreWrap.style.display = 'block';
  } else {
    loadMoreWrap.style.display = 'none';
  }
}

function buildCard(laptop) {
  const card = document.createElement('div');
  const inCompare = isInCompare(laptop.id);
  card.className = 'laptop-card' + (inCompare ? ' in-compare' : '');
  card.addEventListener('click', () => openPriceModal(laptop));

  const msrp = getMsrp(laptop.price);
  const bestPrice = getBestRetailerPrice(laptop);

  const conditionTag = laptop.condition !== 'New'
    ? `<span class="card-tag condition-${laptop.condition.toLowerCase().replace(' ', '-')}">${laptop.condition}</span>`
    : '';

  card.innerHTML = `
    <div class="card-top">
      <span class="card-badge badge-${laptop.type}">${laptop.type}</span>
      <div class="card-price-wrap">
        <span class="card-msrp">$${msrp.toLocaleString()}</span>
        <span class="card-price">from $${bestPrice.toLocaleString()}</span>
      </div>
    </div>
    <div>
      <div class="card-brand">${laptop.brand}</div>
      <div class="card-name">${laptop.name}</div>
    </div>
    <div class="card-divider"></div>
    <div class="card-specs">
      <div class="spec-row">
        <span class="spec-highlight">${laptop.ram}</span>
        <span class="spec-dot"></span>
        <span class="spec-highlight">${laptop.storage}</span>
        <span class="spec-dot"></span>
        <span>${laptop.storageType}</span>
      </div>
      <div class="spec-row">${laptop.processor}</div>
      <div class="spec-row">${laptop.gpuName}</div>
      <div class="spec-row">
        <span>${laptop.screenSizeRange}</span>
        <span class="spec-dot"></span>
        <span>${laptop.panelType}</span>
        <span class="spec-dot"></span>
        <span>${laptop.resolution}</span>
        <span class="spec-dot"></span>
        <span>${laptop.refreshRate}</span>
      </div>
    </div>
    <div class="card-footer">
      <span class="card-tag">${laptop.os}</span>
      <span class="card-tag">${laptop.batteryLife}</span>
      <span class="card-tag">${laptop.weightRange}</span>
      <span class="card-tag">${laptop.colorDisplay}</span>
      ${conditionTag}
    </div>
    <div class="card-actions">
      <button type="button" class="card-compare-btn${inCompare ? ' selected' : ''}" data-laptop-id="${laptop.id}">${inCompare ? 'In compare' : 'Add to compare'}</button>
    </div>
    <div class="card-compare">Compare prices at ${RETAILERS.length} stores →</div>
  `;

  const compareBtn = card.querySelector('.card-compare-btn');
  compareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCompare(laptop.id);
  });

  const priceStrip = card.querySelector('.card-compare');
  priceStrip.addEventListener('click', (e) => {
    e.stopPropagation();
    openPriceModal(laptop);
  });

  return card;
}

function openPriceModal(laptop) {
  if (!priceModal) return;

  const msrp = getMsrp(laptop.price);
  const prices = getRetailerPrices(laptop).sort((a, b) => a.price - b.price);
  const bestPrice = prices[0].price;

  el('modal-laptop-name').textContent = laptop.name;
  el('modal-laptop-sub').textContent =
    `${laptop.brand} · ${laptop.processor} · ${laptop.ram} · ${laptop.storage} · ${laptop.screenSizeRange} ${laptop.panelType}`;

  const wrap = el('modal-retailer-cards');
  wrap.innerHTML = '';

  prices.forEach((deal) => {
    const best = deal.price === bestPrice;
    const card = document.createElement('div');
    card.className = 'retailer-card' + (best ? ' best-deal' : '');
    card.style.background = deal.bg;

    card.innerHTML = `
      ${best ? '<div class="best-badge">Lowest price</div>' : '<div class="best-badge-placeholder"></div>'}
      <div class="retailer-name" style="color:${deal.color}">${deal.name}</div>
      <div class="retailer-msrp">List: <s>$${msrp.toLocaleString()}</s></div>
      <div class="retailer-price">$${deal.price.toLocaleString()}</div>
      <div class="retailer-savings">Save $${deal.savings.toLocaleString()}</div>
      <a class="retailer-btn" href="${deal.url}" target="_blank" rel="noopener noreferrer"
         style="background:${deal.color}">View store ↗</a>
    `;

    wrap.appendChild(card);
  });

  priceModal.classList.add('open');
  lockPageScroll();
}

function closePriceModal() {
  if (!priceModal) return;
  priceModal.classList.remove('open');
  lockPageScroll();
}

function getLaptopById(id) {
  return laptops.find((l) => l.id === id);
}

function isInCompare(id) {
  return compareIds.includes(id);
}

function loadCompareIds() {
  try {
    const raw = sessionStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return;
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return;
    compareIds = ids
      .map(Number)
      .filter((id) => laptops.some((l) => l.id === id))
      .slice(0, COMPARE_MAX);
  } catch (err) {
    compareIds = [];
  }
}

function saveCompareIds() {
  try {
    sessionStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(compareIds));
  } catch (err) {}
}

function toggleCompare(id) {
  if (isInCompare(id)) {
    removeFromCompare(id);
    return;
  }
  if (compareIds.length >= COMPARE_MAX) {
    renderCompareTray(true);
    return;
  }
  compareIds.push(id);
  saveCompareIds();
  renderCompareTray();
  updateCompareButtons();
}

function removeFromCompare(id) {
  compareIds = compareIds.filter((x) => x !== id);
  saveCompareIds();
  renderCompareTray();
  updateCompareButtons();
}

function clearCompare() {
  compareIds = [];
  saveCompareIds();
  renderCompareTray();
  updateCompareButtons();
}

function updateCompareButtons() {
  document.querySelectorAll('.card-compare-btn').forEach((btn) => {
    const id = Number(btn.dataset.laptopId);
    const selected = isInCompare(id);
    btn.classList.toggle('selected', selected);
    btn.textContent = selected ? 'In compare' : 'Add to compare';
  });
  document.querySelectorAll('.laptop-card').forEach((card) => {
    const btn = card.querySelector('.card-compare-btn');
    if (!btn) return;
    card.classList.toggle('in-compare', btn.classList.contains('selected'));
  });
}

function renderCompareTray(showFullHint) {
  const tray = el('compare-tray');
  const countEl = el('compare-tray-count');
  const itemsEl = el('compare-tray-items');
  const goBtn = el('compare-tray-go');
  const count = compareIds.length;
  document.body.classList.toggle('compare-tray-open', count > 0);

  if (count === 0) {
    tray.hidden = true;
    return;
  }

  tray.hidden = false;
  tray.classList.toggle('compare-tray-full', showFullHint === true);

  if (showFullHint) {
    setTimeout(() => tray.classList.remove('compare-tray-full'), 2000);
  }

  countEl.textContent = `${count} of ${COMPARE_MAX}`;
  goBtn.disabled = count < COMPARE_MIN;
  goBtn.textContent = count < COMPARE_MIN
    ? `Add ${COMPARE_MIN - count} more`
    : 'Compare';

  itemsEl.innerHTML = '';
  compareIds.forEach((id) => {
    const laptop = getLaptopById(id);
    if (!laptop) return;

    const item = document.createElement('div');
    item.className = 'compare-tray-item';

    const nameEl = document.createElement('span');
    nameEl.className = 'compare-tray-item-name';
    nameEl.textContent = laptop.name;
    nameEl.title = `${laptop.brand} · ${laptop.name}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'compare-tray-item-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', () => removeFromCompare(id));

    item.appendChild(nameEl);
    item.appendChild(removeBtn);
    itemsEl.appendChild(item);
  });
}

const compareSpecRows = [
  ['Best price', (l) => `$${getBestRetailerPrice(l).toLocaleString()}`],
  ['List price', (l) => `$${getMsrp(l.price).toLocaleString()}`],
  ['Brand', (l) => l.brand],
  ['Type', (l) => l.type],
  ['Processor', (l) => l.processor],
  ['RAM', (l) => l.ram],
  ['Storage', (l) => `${l.storage} ${l.storageType}`],
  ['GPU', (l) => l.gpuName],
  ['Screen', (l) => l.screenSizeRange],
  ['Panel', (l) => l.panelType],
  ['Resolution', (l) => l.resolution],
  ['Refresh rate', (l) => l.refreshRate],
  ['OS', (l) => l.os],
  ['Battery', (l) => l.batteryLife],
  ['Weight', (l) => l.weightRange],
  ['Ports', (l) => (l.ports || []).join(', ')],
  ['Features', (l) => (l.features || []).join(', ')],
  ['Condition', (l) => l.condition],
];

function openCompareModal() {
  if (!compareModal || compareIds.length < COMPARE_MIN) return;

  const selected = compareIds.map(getLaptopById).filter(Boolean);
  const wrap = el('compare-table-wrap');
  if (!wrap) return;

  const table = document.createElement('table');
  table.className = 'compare-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const blankTh = document.createElement('th');
  blankTh.scope = 'col';
  blankTh.textContent = 'Spec';
  headRow.appendChild(blankTh);

  selected.forEach((laptop) => {
    const th = document.createElement('th');
    th.scope = 'col';
    const brandSpan = document.createElement('span');
    brandSpan.className = 'compare-col-brand';
    brandSpan.textContent = laptop.brand;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'compare-col-name';
    nameSpan.textContent = laptop.name;
    th.appendChild(brandSpan);
    th.appendChild(nameSpan);
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const [label, valueFn] of compareSpecRows) {
    const tr = document.createElement('tr');
    const labelTd = document.createElement('th');
    labelTd.scope = 'row';
    labelTd.textContent = label;
    tr.appendChild(labelTd);

    for (const laptop of selected) {
      const td = document.createElement('td');
      td.textContent = valueFn(laptop);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  wrap.innerHTML = '';
  wrap.appendChild(table);

  compareModal.classList.add('open');
  lockPageScroll();
}

function closeCompareModal() {
  if (!compareModal) return;
  compareModal.classList.remove('open');
  lockPageScroll();
}

function lockPageScroll() {
  const modalUp =
    priceModal.classList.contains('open') ||
    compareModal.classList.contains('open');
  const filtersUp = el('filter-panel').classList.contains('open');
  document.body.style.overflow = modalUp || filtersUp ? 'hidden' : '';
}

function matchesOption(laptop, catDef, value) {
  if (catDef.type === 'array') {
    return laptop[catDef.key] && laptop[catDef.key].includes(value);
  }
  return laptop[catDef.key] === value;
}

function setFilterOptionState(categoryLabel, option, state) {
  filterState[categoryLabel][option] = state;
  appliedFilters[categoryLabel][option] = state;
  const cbId = `cb-${categoryLabel}-${option}`.replace(/\s+/g, '_');
  const box = document.getElementById(cbId);
  if (box) {
    box.dataset.state = state;
    box.textContent = getCheckboxIcon(state);
  }
}

function buildAppliedPill(prefix, value, mode, onBodyClick, onRemove) {
  const pill = document.createElement('div');
  pill.className = 'active-filter-pill' + (mode ? ` ${mode}` : ' search');
  if (mode) pill.title = 'Toggle include / exclude';

  const modeSlot = document.createElement('span');
  modeSlot.className = mode ? 'active-filter-mode' : 'active-filter-mode active-filter-mode--empty';
  if (mode) modeSlot.textContent = mode === 'include' ? '✓' : '✗';

  const labelWrap = document.createElement('span');
  labelWrap.className = 'active-filter-label';

  const prefixEl = document.createElement('span');
  prefixEl.className = 'active-filter-prefix';
  prefixEl.textContent = prefix;

  const sep = document.createElement('span');
  sep.className = 'active-filter-sep';
  sep.textContent = '·';

  const textEl = document.createElement('span');
  textEl.className = 'active-filter-text';
  textEl.textContent = value;

  labelWrap.append(prefixEl, sep, textEl);

  const removeEl = document.createElement('span');
  removeEl.className = 'active-filter-remove';
  removeEl.textContent = '×';
  removeEl.title = 'Remove';
  removeEl.addEventListener('click', (e) => {
    e.stopPropagation();
    onRemove();
  });

  pill.addEventListener('click', onBodyClick);
  pill.append(modeSlot, labelWrap, removeEl);
  return pill;
}

function showAppliedBar() {
  const bar = el('active-filters-bar');
  const list = el('active-filters-list');
  list.innerHTML = '';

  const pills = [];

  if (searchQuery) {
    pills.push(buildAppliedPill('Search', searchQuery, null, resetSearch, resetSearch));
  }

  for (const cat of filterDefs) {
    for (const opt of cat.options) {
      const state = appliedFilters[cat.label][opt];
      if (state !== 1 && state !== 2) continue;
      const mode = state === 1 ? 'include' : 'exclude';
      pills.push(buildAppliedPill(
        cat.label,
        opt,
        mode,
        () => {
          setFilterOptionState(cat.label, opt, state === 1 ? 2 : 1);
          runFilter();
        },
        () => {
          setFilterOptionState(cat.label, opt, 0);
          runFilter();
        },
      ));
    }
  }

  if (pills.length === 0) {
    bar.hidden = true;
    return;
  }

  bar.hidden = false;
  for (const pill of pills) list.appendChild(pill);
}

function updateSearchClearVisibility() {
  const input = el('search-input');
  const clearBtn = el('search-clear');
  if (!input) return;
  const hasSearch = input.value.trim().length > 0 || searchQuery.length > 0;
  if (clearBtn) {
    clearBtn.hidden = !hasSearch;
    clearBtn.style.display = hasSearch ? 'flex' : 'none';
  }
}

function resetSearch() {
  const searchInput = el('search-input');
  if (!searchInput) return;
  searchInput.value = '';
  searchQuery = '';
  updateSearchClearVisibility();
  runFilter();
}

function commitSearchFromInput() {
  const input = el('search-input');
  if (!input) return;
  searchQuery = input.value.trim().toLowerCase();
  updateSearchClearVisibility();
}

function applyFilters() {
  commitSearchFromInput();
  appliedFilters = JSON.parse(JSON.stringify(filterState));
  runFilter();
}

function runFilter() {
  let results = laptops.slice();

  if (searchQuery) {
    results = results.filter((l) => buildSearchText(l).includes(searchQuery));
  }

  filterDefs.forEach((cat) => {
    const catState = appliedFilters[cat.label];
    const included = cat.options.filter(opt => catState[opt] === 1);
    const excluded = cat.options.filter(opt => catState[opt] === 2);

    if (included.length > 0) {
      results = results.filter((l) => included.some((opt) => matchesOption(l, cat, opt)));
    }
    if (excluded.length > 0) {
      results = results.filter((l) => !excluded.some((opt) => matchesOption(l, cat, opt)));
    }
  });

  customChips.forEach((chip) => {
    if (chip.type === 'include') {
      results = results.filter((l) => laptopMatchesKeyword(l, chip.text));
    } else {
      results = results.filter((l) => !laptopMatchesKeyword(l, chip.text));
    }
  });

  results = sortResults(results);

  filteredResults = results;
  visibleCount = PAGE_SIZE;
  renderResults();
  showAppliedBar();
}

function sortResults(list) {
  const copy = [...list];
  switch (currentSort) {
    case 'price-asc':
      return copy.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return copy.sort((a, b) => b.price - a.price);
    case 'name-asc':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return list;
  }
}

function clearAllFilters() {
  initFilterState();
  customChips = [];
  searchQuery = '';
  const searchInput = el('search-input');
  if (searchInput) searchInput.value = '';
  currentSort = 'default';
  const sortSelect = el('sort-select');
  if (sortSelect) sortSelect.value = 'default';
  updateSearchClearVisibility();
  renderFilterPanel();
  renderChips();
  runFilter();
}

function openFilterPanel() {
  el('filter-panel').classList.add('open');
  el('filter-overlay').classList.add('visible');
  lockPageScroll();
}

function closeFilterPanel() {
  el('filter-panel').classList.remove('open');
  el('filter-overlay').classList.remove('visible');
  lockPageScroll();
}

function addKeywordChip() {
  const input = el('keyword-input');
  const raw = input.value.trim();
  if (!raw) return;

  const mode = el('keyword-mode').dataset.mode;
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);

  for (const text of parts) {
    const dup = customChips.some((c) => c.text.toLowerCase() === text.toLowerCase());
    if (!dup) customChips.push({ text, type: mode });
  }

  input.value = '';
  renderChips();
  runFilter();
}

document.addEventListener('DOMContentLoaded', async () => {
  priceModal = el('price-modal');
  compareModal = el('compare-modal');

  const countEl = el('results-count');
  if (countEl) countEl.textContent = 'Loading…';

  const rows = await loadLaptops();
  if (rows) {
    startApp(rows);
  } else {
    showCatalogError();
    return;
  }

  const searchInput = el('search-input');
  const searchClear = el('search-clear');

  searchInput.addEventListener('input', () => {
    updateSearchClearVisibility();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (searchInput.value.trim() || searchQuery) {
        e.preventDefault();
        resetSearch();
      }
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    commitSearchFromInput();
    runFilter();
    const resultsHeader = el('results-header');
    if (resultsHeader) {
      resultsHeader.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  searchClear.addEventListener('click', resetSearch);

  el('apply-filters').addEventListener('click', () => {
    applyFilters();
    if (window.innerWidth <= MOBILE_MAX) {
      closeFilterPanel();
    }
  });

  el('clear-all').addEventListener('click', clearAllFilters);
  el('no-results-clear').addEventListener('click', clearAllFilters);
  el('active-filters-clear').addEventListener('click', clearAllFilters);

  el('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    filteredResults = sortResults(filteredResults);
    visibleCount = PAGE_SIZE;
    renderResults();
  });

  el('load-more').addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    renderResults();
  });

  const keywordModeBtn = el('keyword-mode');
  keywordModeBtn.addEventListener('click', () => {
    const isInclude = keywordModeBtn.dataset.mode === 'include';
    keywordModeBtn.dataset.mode = isInclude ? 'exclude' : 'include';
    keywordModeBtn.textContent = isInclude ? '✗' : '✓';
  });

  el('keyword-add').addEventListener('click', addKeywordChip);
  el('keyword-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addKeywordChip();
  });

  el('filter-toggle').addEventListener('click', openFilterPanel);
  el('filter-overlay').addEventListener('click', closeFilterPanel);

  el('modal-close').addEventListener('click', closePriceModal);
  priceModal.addEventListener('click', (e) => {
    if (e.target === priceModal) closePriceModal();
  });

  el('compare-tray-clear').addEventListener('click', clearCompare);
  el('compare-tray-go').addEventListener('click', openCompareModal);
  el('compare-modal-close').addEventListener('click', closeCompareModal);
  compareModal.addEventListener('click', (e) => {
    if (e.target === compareModal) closeCompareModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (compareModal.classList.contains('open')) {
      closeCompareModal();
    } else if (priceModal.classList.contains('open')) {
      closePriceModal();
    } else if (el('filter-panel').classList.contains('open')) {
      closeFilterPanel();
    }
  });

  el('filter-close').addEventListener('click', closeFilterPanel);

  window.addEventListener('resize', () => {
    if (window.innerWidth > MOBILE_MAX && el('filter-panel').classList.contains('open')) {
      closeFilterPanel();
    }
  });
});
