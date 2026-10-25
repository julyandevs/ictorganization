(function () {
  'use strict';

  const FALLBACK = 'Information to be added here.';
  const reduceQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduceMotion = () => Boolean(reduceQuery && reduceQuery.matches);

  /* ---------- Helpers ---------- */

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const paragraphs = (text) => String(text || '')
    .split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

  const listOf = (value) => (Array.isArray(value) ? value : [])
    .map((v) => String(v ?? '').trim()).filter(Boolean);

  const splitTech = (value) => String(value || '')
    .split(',').map((s) => s.trim()).filter(Boolean);

  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');

  const isVisible = (el) => Boolean(el && el.isConnected && el.getClientRects().length);

  /* Waits for a CSS transition on `el` to finish, with a timeout fallback. */
  function transitionDone(el, property, timeout) {
    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        el.removeEventListener('transitionend', onEnd);
        resolve();
      };
      const onEnd = (e) => {
        if (e.target === el && e.propertyName === property) finish();
      };
      el.addEventListener('transitionend', onEnd);
      setTimeout(finish, timeout);
    });
  }

  function decodeSafe(img) {
    return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  }

  /* Returns the thumbnail rect if it is on screen, otherwise null. */
  function onScreenRect(el) {
    if (!isVisible(el)) return null;
    const r = el.getBoundingClientRect();
    const onScreen = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    return onScreen ? r : null;
  }

  /* ---------- Icons (stroke-based, inherit currentColor) ---------- */

  const ICONS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevLeft: '<path d="M15 5l-7 7 7 7"/>',
    chevRight: '<path d="M9 5l7 7-7 7"/>',
    zoom: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    user: '<circle cx="12" cy="9" r="4"/><path d="M4 20c1.6-3.8 4.5-5.5 8-5.5s6.4 1.7 8 5.5"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M10 8v8M14 8v8M17 8v8"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.2c2.2.3 3.8 1.9 4.5 4.8"/>',
    shield: '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    mobile: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17 18z"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M9 21h6M10 17h4"/>',
    medal: '<circle cx="12" cy="15" r="6"/><path d="M8.5 9L6 3h4l2 4 2-4h4l-2.5 6"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  };

  function icon(name, size = 22) {
    const path = ICONS[name] || ICONS.check;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
  }

  /* ---------- Lightbox: full-screen viewer with shared-element zoom ---------- */

  class Lightbox {
    constructor() {
      this.items = [];
      this.index = 0;
      this.sourceFor = () => null;
      this.open = false;
      this.closing = false;
      this.busy = false;
      this.opener = null;
      this.el = this.build();
      this.img = this.el.querySelector('.lb-img');
      this.titleEl = this.el.querySelector('.lb-title');
      this.descEl = this.el.querySelector('.lb-desc');
      this.countEl = this.el.querySelector('.lb-count');
      this.closeBtn = this.el.querySelector('.lb-close');
      this.prevBtn = this.el.querySelector('.lb-prev');
      this.nextBtn = this.el.querySelector('.lb-next');
      this.bind();
    }

    build() {
      const el = document.createElement('div');
      el.className = 'lightbox';
      el.hidden = true;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', 'Screenshot viewer');
      el.innerHTML = `
        <div class="lb-backdrop" aria-hidden="true"></div>
        <div class="lb-stage">
          <button class="lb-close" type="button" aria-label="Close viewer">${icon('x', 22)}</button>
          <button class="lb-nav lb-prev" type="button" aria-label="Previous screenshot">${icon('chevLeft', 26)}</button>
          <figure class="lb-figure">
            <img class="lb-img" alt="" draggable="false" />
            <figcaption class="lb-caption">
              <strong class="lb-title"></strong>
              <span class="lb-desc"></span>
              <span class="lb-count" aria-live="polite"></span>
            </figcaption>
          </figure>
          <button class="lb-nav lb-next" type="button" aria-label="Next screenshot">${icon('chevRight', 26)}</button>
        </div>`;
      document.body.appendChild(el);
      return el;
    }

    bind() {
      /* Clicks: buttons, the image and caption are handled; empty area closes. */
      this.el.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn === this.closeBtn) return this.close();
        if (btn === this.prevBtn) return this.go(-1);
        if (btn === this.nextBtn) return this.go(1);
        if (e.target.closest('.lb-img, .lb-caption')) return;
        this.close();
      });

      /* Swipe on touch screens. */
      let startX = null;
      this.el.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
      this.el.addEventListener('touchend', (e) => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        startX = null;
        if (Math.abs(dx) > 50) this.go(dx < 0 ? 1 : -1);
      });

      /* Capture phase so Escape closes only the viewer, not the modal beneath. */
      document.addEventListener('keydown', (e) => {
        if (!this.open) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.close();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.go(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.go(1);
        } else if (e.key === 'Tab') {
          /* Keep focus inside the viewer. */
          const focusable = [this.closeBtn, this.prevBtn, this.nextBtn].filter(isVisible);
          if (!focusable.length) return;
          e.preventDefault();
          const i = focusable.indexOf(document.activeElement);
          const n = e.shiftKey
            ? (i <= 0 ? focusable.length - 1 : i - 1)
            : (i === -1 || i === focusable.length - 1 ? 0 : i + 1);
          focusable[n].focus();
        }
      }, true);
    }

    navState() {
      const many = this.items.length > 1;
      this.prevBtn.hidden = !many;
      this.nextBtn.hidden = !many;
    }

    setCaption(index) {
      const item = this.items[index];
      this.img.alt = item.title || item.caption || 'Screenshot';
      this.titleEl.textContent = item.title || '';
      this.descEl.textContent = item.caption || '';
      this.descEl.hidden = !item.caption;
      this.countEl.textContent = this.items.length > 1 ? `${index + 1} / ${this.items.length}` : '';
    }

    /* Transform that places the image over a thumbnail, centred and uniformly scaled. */
    transformFrom(sourceRect) {
      const b = this.img.getBoundingClientRect();
      const s = Math.min(sourceRect.width / b.width, sourceRect.height / b.height);
      const dx = (sourceRect.left + sourceRect.width / 2) - (b.left + b.width / 2);
      const dy = (sourceRect.top + sourceRect.height / 2) - (b.top + b.height / 2);
      return `translate(${dx}px, ${dy}px) scale(${s})`;
    }

    async openAt(items, index, sourceFor) {
      if (this.open || !items.length) return;
      this.items = items;
      this.index = index;
      this.sourceFor = sourceFor;
      this.open = true;
      this.busy = false;
      this.closing = false;
      this.opener = sourceFor(index);

      this.el.classList.remove('is-open');
      this.img.className = 'lb-img';
      this.img.style.transform = '';
      this.navState();
      this.setCaption(index);
      this.el.hidden = false;
      document.body.style.overflow = 'hidden';
      this.img.src = items[index].src;
      await decodeSafe(this.img);

      const reduce = reduceMotion();
      const source = onScreenRect(this.opener);
      requestAnimationFrame(() => {
        this.el.classList.add('is-open');
        if (!reduce && source) {
          /* Start the image over the thumbnail, then let it grow into place. */
          this.img.classList.add('is-zoom-start');
          this.img.style.transform = this.transformFrom(source);
          void this.img.offsetWidth;
          this.img.classList.remove('is-zoom-start');
          this.img.style.transform = '';
        } else if (!reduce) {
          this.img.classList.add('is-enter');
        }
      });
      this.closeBtn.focus({ preventScroll: true });
    }

    async close() {
      if (!this.open || this.closing) return;
      this.closing = true;
      const reduce = reduceMotion();
      const source = onScreenRect(this.sourceFor(this.index));

      if (!reduce && source) {
        /* Shrink back into the thumbnail it came from. */
        this.img.classList.remove('is-enter');
        this.img.style.transform = this.transformFrom(source);
        await transitionDone(this.img, 'transform', 700);
      }

      this.el.classList.remove('is-open');
      await wait(reduce ? 0 : 340);
      this.el.hidden = true;
      this.img.className = 'lb-img';
      this.img.style.transform = '';

      const modal = document.getElementById('modal');
      document.body.style.overflow = modal && !modal.hidden ? 'hidden' : '';

      this.open = false;
      this.closing = false;
      if (this.opener && this.opener.isConnected) this.opener.focus({ preventScroll: true });
    }

    async go(delta) {
      if (!this.open || this.busy || this.closing || this.items.length < 2) return;
      this.busy = true;
      const n = this.items.length;
      const next = (this.index + delta + n) % n;
      const reduce = reduceMotion();
      const out = delta > 0 ? 'is-out-left' : 'is-out-right';
      const snap = delta > 0 ? 'is-snap-right' : 'is-snap-left';
      this.img.classList.remove('is-enter'); /* its fill-mode would override nav transforms */

      if (!reduce) {
        this.img.classList.add('is-nav', out);
        await wait(280);
      }

      this.index = next;
      this.setCaption(next);
      this.img.src = this.items[next].src;
      await decodeSafe(this.img);

      if (!reduce) {
        /* Place the new image on the opposite side without animating, then slide it in. */
        this.img.classList.add(snap);
        void this.img.offsetWidth;
        this.img.classList.remove(out, snap);
        await wait(300);
        this.img.classList.remove('is-nav');
      }
      this.busy = false;
    }
  }

  /* ---------- Project Details modal ---------- */

  function galleryFor(project, details) {
    const raw = Array.isArray(details.gallery) ? details.gallery : [];
    const shots = raw
      .filter((g) => g && g.src)
      .map((g, i) => ({
        src: g.src,
        title: g.title || `Screenshot ${i + 1}`,
        caption: g.caption || '',
        category: g.category || '',
      }));
    if (!shots.length && project.image) {
      shots.push({ src: project.image, title: project.title, caption: 'Project thumbnail', category: '' });
    }
    return shots;
  }

  class ProjectModal {
    constructor() {
      this.lightbox = new Lightbox();
      this.project = null;
      this.details = {};
      this.gallery = [];
      this.visibleGallery = [];
      this.galleryFilter = 'All';
      this.bound = false;
    }

    /* Called by script.js. */
    open(project) {
      const modal = document.getElementById('modal');
      const box = document.getElementById('modal-box');
      const body = document.getElementById('modal-body');
      if (!modal || !box || !body || !project) return;

      this.project = project;
      this.details = (window.ICT_PROJECT_DETAILS || {})[project.id] || {};
      this.gallery = galleryFor(project, this.details);
      this.galleryFilter = 'All';

      body.innerHTML = this.template();
      body.scrollTop = 0;
      modal.classList.add('project-modal');
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      this.bind(body);
      box.focus({ preventScroll: true });
    }

    bind(body) {
      if (this.bound) return;
      this.bound = true;
      body.addEventListener('click', (e) => {
        const filter = e.target.closest('[data-pm-filter]');
        if (filter) {
          this.galleryFilter = filter.dataset.pmFilter;
          const host = body.querySelector('[data-pm-gallery]');
          if (host) host.innerHTML = this.galleryInner();
          return;
        }
        const thumb = e.target.closest('[data-pm-thumb]');
        if (thumb) {
          const index = Number(thumb.dataset.pmThumb);
          const thumbs = () => [...body.querySelectorAll('[data-pm-thumb]')];
          this.lightbox.openAt(this.visibleGallery, index, (i) => thumbs()[i]);
        }
      });
    }

    template() {
      const p = this.project;
      const d = this.details;
      const overview = paragraphs(d.overview || p.description);
      const systemDesc = paragraphs(d.systemDescription);
      const tech = listOf(d.technologies).length ? listOf(d.technologies) : splitTech(p.tech);
      const features = (Array.isArray(d.features) ? d.features : []).filter((f) => f && f.title);
      const developers = (Array.isArray(d.developers) ? d.developers : []).filter((m) => m && m.name);
      const challenges = listOf(d.challenges);
      const solutions = listOf(d.solutions);
      const cover = p.image;

      return `
        <div class="pm-hero">
          ${cover
            ? `<img class="pm-hero-img" src="${esc(cover)}" alt="" />`
            : `<div class="pm-hero-fallback" aria-hidden="true">${icon('layers', 64)}</div>`}
          <div class="pm-hero-shade" aria-hidden="true"></div>
          <div class="pm-hero-text">
            <span class="pm-badge">${esc(p.batch || 'Project')}</span>
            <h2 id="modal-title">${esc(p.title)}</h2>
          </div>
        </div>

        <div class="pm-body">
          ${this.section('Awards &amp; Recognition', this.awardsHTML(d.awards))}

          ${this.section('Project Overview', overview.length
            ? overview.map((t) => `<p>${esc(t)}</p>`).join('')
            : `<p>${esc(FALLBACK)}</p>`)}

          ${this.section('Objectives', this.list(d.objectives))}
          ${this.section('Target Users', this.list(d.targetUsers))}

          ${this.section('Key Features', features.length ? `
            <div class="pm-features">
              ${features.map((f) => `
                <article class="pm-feature">
                  <span class="pm-icon">${icon(f.icon || 'check', 22)}</span>
                  <h4>${esc(f.title)}</h4>
                  ${f.text ? `<p>${esc(f.text)}</p>` : ''}
                </article>`).join('')}
            </div>` : '')}

          ${this.section('System Description', systemDesc.map((t) => `<p>${esc(t)}</p>`).join(''))}

          ${this.section('Technologies Used', tech.length
            ? `<ul class="tags">${tech.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
            : '')}

          ${this.section('Challenges &amp; Solutions', challenges.length || solutions.length ? `
            <div class="pm-cs">
              ${challenges.length ? `<div class="pm-panel"><h4>Challenges Encountered</h4>${this.list(challenges)}</div>` : ''}
              ${solutions.length ? `<div class="pm-panel"><h4>Solutions Implemented</h4>${this.list(solutions)}</div>` : ''}
            </div>` : '')}

          ${this.section('Project Outcomes', this.list(d.outcomes))}

          ${this.section('Project Gallery', `<div class="pm-gallery-wrap" data-pm-gallery>${this.galleryInner()}</div>`)}

          ${this.section('Developers &amp; Contributors', developers.length ? `
            <div class="pm-devs">
              ${developers.map((m) => `
                <article class="pm-dev">
                  <div class="pm-dev-photo">${m.photo
                    ? `<img src="${esc(m.photo)}" alt="" loading="lazy" onerror="this.hidden=true" />`
                    : icon('user', 26)}</div>
                  <div>
                    <h4>${esc(m.name)}</h4>
                    ${m.role ? `<span class="pm-dev-role">${esc(m.role)}</span>` : ''}
                    ${m.contribution ? `<p>${esc(m.contribution)}</p>` : ''}
                  </div>
                </article>`).join('')}
            </div>` : '')}

          <footer class="pm-footer">
            ${p.link ? `<a class="btn" href="${esc(safeUrl(p.link))}" target="_blank" rel="noopener noreferrer">Open project ${icon('external', 16)}</a>` : ''}
            <button class="btn btn-outline" type="button" data-action="close-modal">Close</button>
          </footer>
        </div>`;
    }

    /* Award cards with a gold medal, shown first in the modal so they stand out. */
    awardsHTML(awards) {
      const list = (Array.isArray(awards) ? awards : []).filter((a) => a && a.title);
      if (!list.length) return '';
      return `<div class="pm-awards">${list.map((a) => `
        <article class="pm-award">
          <span class="pm-award-medal" aria-hidden="true">${icon(a.icon || 'trophy', 30)}</span>
          <div class="pm-award-text">
            <span class="pm-award-label">Achievement</span>
            <h4>${esc(a.title)}</h4>
            ${a.batch ? `<p class="pm-award-meta">${esc(a.batch)}</p>` : ''}
            ${a.note ? `<p>${esc(a.note)}</p>` : ''}
          </div>
        </article>`).join('')}</div>`;
    }

    /* Wraps content in a titled section. Empty content renders nothing. */
    section(title, inner) {
      if (!inner || !inner.trim()) return '';
      const id = 'pm-' + title.toLowerCase().replace(/&amp;|&/g, 'and').replace(/[^a-z]+/g, '-');
      return `
        <section class="pm-section" aria-labelledby="${id}">
          <h3 class="pm-title" id="${id}">${title}</h3>
          ${inner}
        </section>`;
    }

    list(values) {
      const items = listOf(values);
      if (!items.length) return '';
      return `<ul class="pm-list">${items.map((t) => `
        <li><span class="pm-check">${icon('check', 18)}</span><span>${esc(t)}</span></li>`).join('')}</ul>`;
    }

    /* Filter pills plus the thumbnail grid. Sets visibleGallery for the lightbox. */
    galleryInner() {
      const categories = [...new Set(this.gallery.map((g) => g.category).filter(Boolean))];
      const showFilters = categories.length > 1;
      this.visibleGallery = this.galleryFilter === 'All' || !showFilters
        ? this.gallery
        : this.gallery.filter((g) => g.category === this.galleryFilter);

      if (!this.visibleGallery.length) return '<p class="muted">No screenshots yet.</p>';

      const filters = showFilters ? ['All', ...categories] : [];
      return `
        ${filters.length ? `
          <div class="tabs pm-filters" role="group" aria-label="Filter screenshots">
            ${filters.map((f) => `
              <button type="button" class="pill${f === this.galleryFilter ? ' active' : ''}"
                aria-pressed="${f === this.galleryFilter}" data-pm-filter="${esc(f)}">${esc(f)}</button>`).join('')}
          </div>` : ''}
        <div class="pm-gallery">
          ${this.visibleGallery.map((g, i) => `
            <button type="button" class="pm-thumb" data-pm-thumb="${i}"
              aria-label="View ${esc(g.title)}, ${i + 1} of ${this.visibleGallery.length}">
              <img src="${esc(g.src)}" alt="" loading="lazy" decoding="async" />
              <span class="pm-thumb-shade" aria-hidden="true"></span>
              <span class="pm-thumb-zoom" aria-hidden="true">${icon('zoom', 22)}</span>
              <span class="pm-thumb-cap">${esc(g.title)}</span>
            </button>`).join('')}
        </div>`;
    }
  }

  window.ICTProjectModal = new ProjectModal();
})();