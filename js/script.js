'use strict';

/* Configuration */

const STORAGE_KEY = 'ict-org-site-v1';
const BATCHES = ['Batch 2025', 'Batch 2026', 'Batch 2027'];
const GALLERY_CATEGORIES = ['Events', 'Projects', 'Activities', 'Group Photos'];
const FALLBACK_TEXT = 'Information to be added here.';
const PAGE_NAMES = ['home', 'about', 'projects', 'officers', 'members',
  'events', 'announcements', 'gallery', 'contact'];

const DEFAULT_DATA = {
  settings: {
    orgName: 'Information & Communication Technology Organization',
    tagline: 'Empowering future innovators through technology, collaboration, and continuous learning.',
    about: '', mission: '', vision: '', values: '',
    email: '', phone: '', location: '',
  },
  projects: [], batches: [], officers: [], members: [],
  events: [], announcements: [], gallery: [], messages: [],
};

/* Small utilities */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const splitList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const splitLines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const isPast = (d) => Boolean(d) && new Date(d + 'T23:59:59') < new Date();
const memberBatchLabel = (m) => m.batch || '';
/* Inline SVG icons (stroke-based, inherit currentColor). */
const ICON_PATHS = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="9" r="4"/><path d="M4 20c1.6-3.8 4.5-5.5 8-5.5s6.4 1.7 8 5.5"/>',
  learn: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 5v16"/>',
  build: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  connect: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 7.5l3 8.5M16 7.5l-3 8.5M8.5 6h7"/>',
  grow: '<path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  pin: '<path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
};
const svg = (name, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name] || ''}</svg>`;
const avatar = (src) => `<div class="avatar">${src ? `<img src="${esc(src)}" alt="" />` : svg('user', 40)}</div>`;

function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach((el) => {
    el.innerHTML = svg(el.dataset.icon, Number(el.dataset.size) || 22);
  });
}

/* Toast & modal */

function toast(message, type = 'ok') {
  const t = $('#toast');
  t.textContent = message;
  t.dataset.type = type;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3200);
}

let lastFocus = null;

function openModal(content) {
  const body = $('#modal-body');
  body.replaceChildren();
  if (typeof content === 'string') body.innerHTML = content;
  else body.append(content);
  lastFocus = document.activeElement;
  $('#modal').hidden = false;
  document.body.style.overflow = 'hidden';
  const first = $('#modal-box').querySelector('input, textarea, select, button, a[href]');
  (first || $('#modal-box')).focus();
}

function closeModal() {
  const modal = $('#modal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  modal.classList.remove('project-modal');
  $('#modal-body').replaceChildren();
  document.body.style.overflow = '';
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

/* Starting content, built from content.js (window.ICT_CONTENT). */
function seedData() {
  const c = window.ICT_CONTENT || {};
  const list = (rows, prefix) => (rows || []).map((r, i) => ({
    id: r.id || `${prefix}-${i + 1}`,
    createdAt: i,
    ...r,
  }));
  return {
    ...structuredClone(DEFAULT_DATA),
    settings: { ...DEFAULT_DATA.settings, ...(c.settings || {}) },
    projects: list(c.projects, 'project'),
    batches: list(c.batches, 'batch'),
    officers: list(c.officers, 'officer'),
    members: list(c.members, 'member').map((m) => ({ status: 'Active', ...m })),
    events: list(c.events, 'event'),
    announcements: list(c.announcements, 'announcement'),
    gallery: list(c.gallery, 'gallery'),
  };
}

/* Storage */

class Store {
  constructor(key) {
    this.key = key;
    this.data = this.read();
  }

  read() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.key) || 'null');
      if (!saved) return seedData();
      return {
        ...structuredClone(DEFAULT_DATA),
        ...saved,
        settings: { ...DEFAULT_DATA.settings, ...(saved.settings || {}) },
      };
    } catch (err) {
      console.error('Saved site data could not be read:', err);
      return seedData();
    }
  }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
      return true;
    } catch (err) {
      console.error(err);
      toast('Browser storage is full. Remove some images or export a backup.', 'error');
      return false;
    }
  }

  all(name) { return this.data[name] || []; }
  get(name, id) { return this.all(name).find((r) => r.id === id); }

  add(name, record) {
    const item = { ...record, id: uid(), createdAt: Date.now() };
    this.data[name].push(item);
    if (this.save()) return item;
    this.data[name].pop();
    return null;
  }

  update(name, id, patch) {
    const index = this.data[name].findIndex((r) => r.id === id);
    if (index < 0) return null;
    this.data[name][index] = { ...this.data[name][index], ...patch };
    return this.save() ? this.data[name][index] : null;
  }

  remove(name, id) {
    this.data[name] = this.data[name].filter((r) => r.id !== id);
    return this.save();
  }

}

const store = new Store(STORAGE_KEY);

/* Shared settings binding */

function applySettings() {
  const s = store.data.settings;
  $$('[data-bind]').forEach((el) => {
    el.textContent = s[el.dataset.bind] || el.dataset.fallback || '';
  });
  const list = $('[data-bind-list="values"]');
  if (list) {
    const items = splitLines(s.values);
    list.innerHTML = items.length
      ? items.map((v) => `<li>${esc(v)}</li>`).join('')
      : `<li>${FALLBACK_TEXT}</li>`;
  }
}

/* Tabs */

function renderTabs(container, options, active, onPick) {
  container.innerHTML = options.map((o) => `
    <button type="button" class="pill${o.value === active ? ' active' : ''}" aria-pressed="${o.value === active}" data-tab-value="${esc(o.value)}">${esc(o.label)}</button>`).join('');
  container.onclick = (e) => {
    const btn = e.target.closest('[data-tab-value]');
    if (btn) onPick(btn.dataset.tabValue);
  };
}

const batchOptions = () => [{ value: 'all', label: 'All' }, ...BATCHES.map((b) => ({ value: b, label: b }))];
const officerBatchOptions = () => BATCHES.map((b) => ({ value: b, label: b }));

/* Page state */

const state = {
  projectBatch: 'all',
  officerBatch: 'Batch 2027',
  memberQuery: '',
  memberBatch: 'all',
  memberStatus: 'all',
  eventTab: 'upcoming',
  galleryCat: 'all',
};

/* Blank placeholder cards used when a collection is empty. They contain no names. */
const skeletonCard = () => `
  <div class="card is-placeholder" aria-hidden="true">
    <div class="card-media"><span class="media-empty"></span></div>
    <div class="card-body"><div class="skel"></div><div class="skel short"></div></div>
  </div>`;
const skeletons = (n) => Array.from({ length: n }, skeletonCard).join('');

/* Home */

const sortedAnnouncements = () => store.all('announcements').slice()
  .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));

/* Notifications: the bell dropdown shows the same announcement records.
   Read state is stored per browser and never changes the announcement data. */

const READ_KEY = 'ict-org-site-read-v1';

const readIds = (() => {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { return new Set(); }
})();

function saveReadIds() {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...readIds])); } catch (err) { console.error('Read state could not be saved:', err); }
}

const isUnread = (a) => !readIds.has(a.id);

function notifItem(a) {
  const unread = isUnread(a);
  return `<li><button class="notif-item${unread ? ' is-unread' : ''}" type="button" data-action="notif-open" data-id="${esc(a.id)}">
    <span class="notif-icon">${svg('bell', 16)}</span>
    <span class="notif-text">
      <span class="notif-item-title">${esc(a.title)}</span>
      <span class="notif-item-desc">${esc(a.body || '')}</span>
      <span class="notif-item-time">${esc(fmtDate(a.date) || 'Recently posted')}</span>
    </span>
    ${unread ? '<span class="notif-dot" aria-label="Unread"></span>' : ''}
  </button></li>`;
}

function updateBadge() {
  const unread = sortedAnnouncements().filter(isUnread).length;
  const badge = $('#notif-badge');
  const btn = $('#notif-btn');
  const count = $('#notif-count');
  const markAll = $('#notif-markall');
  if (badge) {
    badge.textContent = unread > 9 ? '9+' : String(unread);
    badge.hidden = unread === 0;
  }
  if (btn) {
    btn.classList.toggle('has-unread', unread > 0);
    btn.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
  }
  if (count) {
    count.textContent = String(unread);
    count.hidden = unread === 0;
  }
  if (markAll) markAll.disabled = unread === 0;
}

function renderAnnouncements() {
  const list = sortedAnnouncements();
  const listEl = $('#notif-list');
  const empty = $('#notif-empty');
  if (listEl) {
    listEl.innerHTML = list.map(notifItem).join('');
    listEl.hidden = list.length === 0;
  }
  if (empty) empty.hidden = list.length > 0;
  updateBadge();
}

function markRead(id) {
  if (!readIds.has(id)) {
    readIds.add(id);
    saveReadIds();
  }
  renderAnnouncements();
}

function markAllRead() {
  sortedAnnouncements().forEach((a) => readIds.add(a.id));
  saveReadIds();
  renderAnnouncements();
}

let notifTimer = null;
const notifIsOpen = () => { const p = $('#notif-panel'); return Boolean(p) && !p.hidden; };

function openNotif() {
  const panel = $('#notif-panel');
  const btn = $('#notif-btn');
  if (!panel || !btn) return;
  clearTimeout(notifTimer);
  renderAnnouncements();
  panel.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  // Two frames so the browser sees the hidden state before the open transition starts.
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('is-open')));
}

function closeNotif({ restoreFocus = false } = {}) {
  const panel = $('#notif-panel');
  const btn = $('#notif-btn');
  if (!panel || !btn || panel.hidden) return;
  panel.classList.remove('is-open');
  btn.setAttribute('aria-expanded', 'false');
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => { panel.hidden = true; }, 200);
  if (restoreFocus) btn.focus();
}

function toggleNotif() {
  if (notifIsOpen()) closeNotif();
  else openNotif();
}

function initNotifications() {
  const btn = $('#notif-btn');
  if (!btn) return;
  btn.addEventListener('click', toggleNotif);
  $('#notif-markall')?.addEventListener('click', markAllRead);
  // Clicking anywhere outside the bell and panel closes the dropdown.
  document.addEventListener('click', (e) => {
    if (notifIsOpen() && !e.target.closest('#notif')) closeNotif();
  });
}

/* Projects */

function projectCard(p) {
  return `
  <article class="card project-card">
    <div class="card-media">
      ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.title)} thumbnail" loading="lazy" onerror="this.style.visibility='hidden'" />` : ''}
    </div>
    <div class="card-body">
      ${p.batch ? `<p class="card-batch">${esc(p.batch)}</p>` : ''}
      <h3>${esc(p.title)}</h3>
      <ul class="tags">${splitList(p.tech).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <div class="card-actions">
        <button class="btn btn-sm" type="button" data-action="project-details" data-id="${p.id}">View Details <span aria-hidden="true">&rarr;</span></button>
      </div>
    </div>
  </article>`;
}

function renderProjects() {
  renderTabs($('#project-tabs'), batchOptions(), state.projectBatch, (v) => {
    state.projectBatch = v;
    renderProjects();
  });
  const all = store.all('projects');
  const list = all.filter((p) => state.projectBatch === 'all' || p.batch === state.projectBatch);
  const note = $('#project-empty');
  note.hidden = all.length > 0;
  note.textContent = 'No projects yet.';
  $('#project-grid').innerHTML = list.length
    ? list.map(projectCard).join('')
    : (all.length ? '<p class="empty">No projects for this batch yet.</p>' : skeletons(3));
}

/* Officers */

const officerCard = (o) => `
  <article class="card officer-card">
    ${avatar(o.photo)}
    <h3>${esc(o.name)}</h3>
    <p class="role">${esc(o.position)}</p>
    <p class="muted">${esc(o.info)}</p>
  </article>`;

const blankOfficerCard = () => `
  <article class="card officer-card is-placeholder" aria-hidden="true">
    ${avatar('')}
    <div class="skel"></div>
    <div class="skel short"></div>
  </article>`;

function batchBlock(batch) {
  const officers = batch ? store.all('officers').filter((o) => o.batchId === batch.id) : [];
  const photo = batch?.groupPhoto
    ? `<img src="${esc(batch.groupPhoto)}" alt="Group photo of ${esc(batch.name)}" />`
    : '<span class="media-empty">Shared group photo will appear here</span>';
  const heading = batch
    ? `<h3>${esc(batch.name)}</h3><p class="muted">${esc(batch.batch || '')}</p>`
    : '<p class="muted">No batches yet.</p>';
  const cards = officers.length
    ? officers.map(officerCard).join('')
    : Array.from({ length: 4 }, blankOfficerCard).join('');
  return `
    <section class="batch">
      <figure class="batch-photo">${photo}</figure>
      <header class="batch-head">${heading}</header>
      <div class="grid officer-grid">${cards}</div>
    </section>`;
}

function renderOfficers() {
  renderTabs($('#officer-tabs'), officerBatchOptions(), state.officerBatch, (v) => {
    state.officerBatch = v;
    renderOfficers();
  });
  const batches = store.all('batches');
  const shown = batches.filter((b) => b.batch === state.officerBatch);
  const host = $('#officer-batches');
  if (!batches.length) host.innerHTML = batchBlock(null);
  else if (!shown.length) host.innerHTML = '<p class="empty">No officers for this batch yet.</p>';
  else host.innerHTML = shown.map(batchBlock).join('');
}

/* Members */

const memberCard = (m) => `
  <button class="member-card" type="button" data-action="member-details" data-id="${m.id}">
    ${avatar(m.photo)}
    <span class="meta">
      <h3>${esc(m.name)}</h3>
      <p>${esc(memberBatchLabel(m))}</p>
      <p>${esc(m.position)}</p>
    </span>
    <span class="status${m.status === 'Inactive' ? ' inactive' : ''}">${esc(m.status || 'Active')}</span>
  </button>`;

function renderMembers() {
  const all = store.all('members');
  const q = state.memberQuery.toLowerCase();
  const list = all.filter((m) =>
    (state.memberBatch === 'all' || m.batch === state.memberBatch) &&
    (state.memberStatus === 'all' || (m.status || 'Active') === state.memberStatus) &&
    [m.name, m.batch, m.position].some((v) => String(v || '').toLowerCase().includes(q)));
  $('#member-grid').innerHTML = list.length
    ? list.map(memberCard).join('')
    : (all.length ? '<p class="empty">No members match your search.</p>' : skeletons(3));
}

/* Events */

function renderEvents() {
  const all = store.all('events');
  const list = all
    .filter((e) => !isPast(e.date))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  $('#event-list').innerHTML = list.length
    ? list.map(eventRow).join('')
    : (all.length ? '' : skeletons(2));
}

/* Gallery */

function renderGallery() {
  renderTabs($('#gallery-tabs'), [{ value: 'all', label: 'All' },
    ...GALLERY_CATEGORIES.map((c) => ({ value: c, label: c }))], state.galleryCat, (v) => {
    state.galleryCat = v;
    renderGallery();
  });
  const all = store.all('gallery');
  const list = all.filter((g) => state.galleryCat === 'all' || g.category === state.galleryCat);
  $('#gallery-grid').innerHTML = list.length
    ? list.map((g) => `
      <button class="gallery-item" type="button" data-action="gallery-view" data-id="${g.id}" aria-label="View photo${g.caption ? `: ${esc(g.caption)}` : ''}">
        <img src="${esc(g.image)}" alt="" loading="lazy" />
        <span class="gallery-cap">${esc(g.caption || g.category || '')}</span>
      </button>`).join('')
    : `<p class="empty">${all.length ? 'No photos in this category.' : 'No photos yet.'}</p>`;
}

/* Detail modals */

/* Project Details modal and lightbox live in project-modal.js. */
function showProject(id) {
  const p = store.get('projects', id);
  if (!p) return;
  window.ICTProjectModal.open(p);
}

function showEvent(id) {
  const e = store.get('events', id);
  if (!e) return;
  openModal(`
    ${e.image ? `<img class="modal-photo" src="${esc(e.image)}" alt="" />` : ''}
    <h2 id="modal-title">${esc(e.title)}</h2>
    <p class="muted">${[fmtDate(e.date), e.time, e.location].filter(Boolean).map(esc).join(' | ')}</p>
    <p class="prose">${esc(e.description || '')}</p>`);
}

function showAnnouncement(id) {
  const a = store.get('announcements', id);
  if (!a) return;
  openModal(`
    <h2 id="modal-title">${esc(a.title)}</h2>
    <p class="muted">${esc(fmtDate(a.date))}</p>
    <p class="prose">${esc(a.body || '')}</p>`);
}

function showMember(id) {
  const m = store.get('members', id);
  if (!m) return;
  openModal(`
    ${avatar(m.photo)}
    <h2 id="modal-title">${esc(m.name)}</h2>
    <dl class="member-facts">
      <dt>Batch</dt><dd>${esc(memberBatchLabel(m))}</dd>
      <dt>Position</dt><dd>${esc(m.position)}</dd>
      <dt>Status</dt><dd>${esc(m.status || 'Active')}</dd>
    </dl>`);
}

function showGalleryItem(id) {
  const g = store.get('gallery', id);
  if (!g) return;
  openModal(`
    <img class="modal-photo" src="${esc(g.image)}" alt="${esc(g.caption || g.category || 'Gallery photo')}" style="aspect-ratio:auto" />
    <h2 id="modal-title">${esc(g.caption || 'Gallery photo')}</h2>
    <p class="muted">${esc(g.category || '')}</p>`);
}

/* Refresh & routing */

function refreshAll() {
  // Each section renders on its own, so one problem never blanks the whole site.
  [applySettings, renderProjects, renderOfficers, renderMembers, renderEvents,
    renderAnnouncements, renderGallery].forEach((fn) => {
    try { fn(); } catch (err) { console.error(`${fn.name} failed:`, err); }
  });
}

const RENDERERS = {
  about: applySettings,
  projects: renderProjects,
  officers: renderOfficers,
  members: renderMembers,
  events: renderEvents,
  announcements: renderAnnouncements,
  gallery: renderGallery,
};

const LANDING_SECTIONS = ['home', 'about', 'projects', 'officers', 'members', 'events', 'gallery', 'contact'];

function setActiveLink(name) {
  $$('[data-route]').forEach((link) => {
    const on = link.dataset.route === name;
    link.classList.toggle('active', on);
    if (on) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

/* All landing sections stay on one scrolling page */
function route() {
  closeModal();
  const [page = 'home'] = location.hash.replace(/^#\/?/, '').split('/').map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });
  const name = PAGE_NAMES.includes(page) ? page : 'home';

  setActiveLink(name);
  closeNav();
  if (name === 'announcements') openNotif();

  if (RENDERERS[name]) RENDERERS[name]();

  document.getElementById(name)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* Highlights the nav link for the section currently in view while scrolling. */
function initScrollSpy() {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) setActiveLink(entry.target.id);
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  LANDING_SECTIONS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

/* Mobile navigation */

function toggleNav() {
  const open = $('#site-nav').classList.toggle('open');
  const btn = $('.nav-toggle');
  btn.setAttribute('aria-expanded', String(open));
  btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

function closeNav() {
  $('#site-nav').classList.remove('open');
  const btn = $('.nav-toggle');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Open menu');
}

/* Event delegation */

function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;

  switch (action) {
    case 'close-modal': return closeModal();
    case 'project-details': return showProject(id);
    case 'event-details': return showEvent(id);
    case 'notif-open': markRead(id); closeNotif(); return showAnnouncement(id);
    case 'member-details': return showMember(id);
    case 'gallery-view': return showGalleryItem(id);
    default: return;
  }
}

function onSubmit(e) {
  const form = e.target;

  if (form.id === 'contact-form') {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const d = Object.fromEntries(new FormData(form).entries());
    const record = { name: d.name.trim(), email: d.email.trim(), message: d.message.trim() };
    if (!store.add('messages', record)) return;
    form.reset();
    const email = store.data.settings.email;
    if (email) {
      const subject = encodeURIComponent(`Website message from ${record.name}`);
      const body = encodeURIComponent(`${record.message}\n\nFrom: ${record.name} <${record.email}>`);
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    }
    toast('Message saved in this browser.');
    return;
  }
}

/* Init */

function init() {
  try { hydrateIcons(); } catch (err) { console.error('hydrateIcons failed:', err); }
  refreshAll(); // render content first so nothing can stop it

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const on = (selector, type, handler) => {
    const el = $(selector);
    if (el) el.addEventListener(type, handler);
  };

  on('.nav-toggle', 'click', toggleNav);
  initNotifications();
  on('#member-search', 'input', (e) => {
    state.memberQuery = e.target.value.trim();
    renderMembers();
  });
  on('#member-batch', 'change', (e) => {
    state.memberBatch = e.target.value;
    renderMembers();
  });
  on('#member-status', 'change', (e) => {
    state.memberStatus = e.target.value;
    renderMembers();
  });

  on('#modal', 'click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeNotif({ restoreFocus: true }); }
  });
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  window.addEventListener('hashchange', route);
  initScrollSpy();

  route();
}

document.addEventListener('DOMContentLoaded', init);