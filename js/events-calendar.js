/* ==========================================================================
   events-calendar.js: Interactive Events & Activities Calendar
   Plain JavaScript, no dependencies. Reads window.ICT_CONTENT.events from
   content.js, so there is one source of event data for the whole site.
   Load content.js before this file.
   ========================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    timeZone: 'Asia/Manila',          // written into Google Calendar links
    defaultDurationMinutes: 60,       // used when an event has no end time
    triggerSelector: '[data-events-calendar-trigger]',
    upcomingSelector: '[data-upcoming-events]'
  };
  if (window.ICT_EVENTS_CONFIG) Object.assign(CONFIG, window.ICT_EVENTS_CONFIG);

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var CALENDAR_HTML =
    '<div class="ec-overlay" id="ec-calendar" hidden>' +
      '<div class="ec-dialog ec-dialog--calendar" role="dialog" aria-modal="true" aria-labelledby="ec-cal-title">' +
        '<div class="ec-head">' +
          '<h2 class="ec-title" id="ec-cal-title">Events &amp; Activities</h2>' +
          '<button type="button" class="ec-icon-btn" data-ec-close aria-label="Close calendar">&times;</button>' +
        '</div>' +
        '<div class="ec-nav">' +
          '<button type="button" class="ec-icon-btn" id="ec-prev" aria-label="Previous month">&lsaquo;</button>' +
          '<h3 class="ec-month" id="ec-month" aria-live="polite"></h3>' +
          '<button type="button" class="ec-icon-btn" id="ec-next" aria-label="Next month">&rsaquo;</button>' +
          '<button type="button" class="ec-today" id="ec-today">Today</button>' +
        '</div>' +
        '<div class="ec-weekdays" aria-hidden="true"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>' +
        '<div class="ec-grid" id="ec-grid"></div>' +
        '<div class="ec-legend"><span><i></i>Event</span><span><i class="is-gold"></i>Multiple events</span></div>' +
        '<div class="ec-panel" id="ec-panel" aria-live="polite"></div>' +
      '</div>' +
    '</div>';

  var DETAIL_HTML =
    '<div class="ec-overlay ec-overlay--detail" id="ec-detail" hidden>' +
      '<article class="ec-dialog ec-dialog--detail" role="dialog" aria-modal="true" aria-labelledby="ec-detail-title">' +
        '<button type="button" class="ec-close-float" data-ec-close aria-label="Close event details">&times;</button>' +
        '<div class="ec-detail-media" id="ec-detail-media"><img id="ec-detail-img" alt=""></div>' +
        '<div class="ec-detail-body" id="ec-detail-body">' +
          '<span class="ec-badge">Event</span>' +
          '<h2 class="ec-detail-title" id="ec-detail-title" tabindex="-1"></h2>' +
          '<dl class="ec-facts">' +
            '<div class="ec-fact"><dt>Date</dt><dd id="ec-detail-date"></dd></div>' +
            '<div class="ec-fact"><dt>Time</dt><dd id="ec-detail-time"></dd></div>' +
            '<div class="ec-fact" id="ec-detail-loc-row"><dt>Location</dt><dd id="ec-detail-loc"></dd></div>' +
            '<div class="ec-fact" id="ec-detail-org-row"><dt>Organizer</dt><dd id="ec-detail-org"></dd></div>' +
          '</dl>' +
          '<p class="ec-detail-desc" id="ec-detail-desc"></p>' +
          '<div id="ec-detail-extra"></div>' +
          '<div class="ec-detail-foot">' +
            '<div class="ec-pager" id="ec-pager">' +
              '<button type="button" class="ec-btn" id="ec-prev-ev" data-ec-step="-1" aria-label="Previous event">&larr;</button>' +
              '<span class="ec-pager-count" id="ec-pager-count" aria-live="polite"></span>' +
              '<button type="button" class="ec-btn" id="ec-next-ev" data-ec-step="1" aria-label="Next event">&rarr;</button>' +
            '</div>' +
            '<a class="ec-btn ec-btn-primary" id="ec-gcal" target="_blank" rel="noopener">Add to Google Calendar</a>' +
          '</div>' +
        '</div>' +
      '</article>' +
    '</div>';

  var events = [];   // normalized events, sorted by start
  var byDay = {};    // 'YYYY-MM-DD' -> [event, ...]
  var ui = {};
  var isOpen = { calendar: false, detail: false };
  var state = {
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
    selectedKey: null,        // survives closing the modals
    detailList: [],
    detailIndex: 0,
    returnFocus: null,
    calendarTrigger: null
  };

  /* ---------- Helpers ---------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

  function keyToDate(key) {
    var p = key.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function parseDate(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || '').trim());
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  // Accepts "8:00 AM", "8 am", "14:30". Returns { h, m } or null.
  function parseTime(str) {
    var m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?(?:\.?m\.?)?\s*$/i.exec(String(str || ''));
    if (!m) return null;
    var h = +m[1], min = m[2] ? +m[2] : 0, ap = (m[3] || '').toLowerCase();
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return { h: h, m: min };
  }

  function fmtTime(d) { return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function fmtLong(d) { return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }

  /* The last calendar day an event covers. An end at exactly midnight belongs to the previous day. */
  function lastDay(ev) {
    var d = startOfDay(ev.end);
    if (ev.end.getTime() === d.getTime()) d = addDays(d, -1);
    var s = startOfDay(ev.start);
    return d < s ? s : d;
  }

  function dateLabel(ev) {
    var text = fmtLong(ev.start);
    var last = lastDay(ev);
    if (dateKey(last) !== dateKey(ev.start)) text += ' – ' + fmtLong(last);
    return text;
  }

  function timeLabel(ev) {
    if (ev.allDay) return 'All day';
    var s = fmtTime(ev.start);
    return ev.end ? s + ' – ' + fmtTime(ev.end) : s;
  }

  /* ---------- Data ---------- */

  /* Accepts either date + time strings (as in content.js) or ISO start/end values. */
  function normalize(ev, i) {
    var start, end = null, allDay = false;

    if (ev.start) {
      start = new Date(ev.start);
      if (ev.end) end = new Date(ev.end);
      allDay = !!ev.allDay;
    } else {
      var day = parseDate(ev.date);
      if (!day) return null;                       // no date yet: not shown on the calendar
      var range = String(ev.time || '').split(/\s+to\s+|\s*[-–—]\s*/i);
      var s = parseTime(range[0]);
      var e = range[1] ? parseTime(range[1]) : null;
      if (s) {
        start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), s.h, s.m);
        if (e) end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), e.h, e.m);
      } else {
        start = day;
        allDay = true;
      }
    }

    if (!start || isNaN(start)) return null;
    if (!end || isNaN(end) || end <= start) {
      end = allDay ? addDays(startOfDay(start), 1)
                   : new Date(start.getTime() + CONFIG.defaultDurationMinutes * 60000);
    }

    return {
      id: ev.id || ('event-' + i),
      title: ev.title || 'Untitled event',
      start: start,
      end: end,
      allDay: allDay,
      location: ev.location || '',
      organizer: ev.organizer || '',
      description: ev.description || '',
      link: ev.link || '',
      image: ev.image || '',
      images: Array.isArray(ev.images) ? ev.images : []
    };
  }

  function buildData() {
    var raw = (window.ICT_CONTENT && window.ICT_CONTENT.events) || [];
    events = raw.map(normalize).filter(Boolean).sort(function (a, b) { return a.start - b.start; });
    byDay = {};
    events.forEach(function (ev) {
      var d = startOfDay(ev.start), last = lastDay(ev), guard = 0;
      while (d <= last && guard++ < 366) {
        var k = dateKey(d);
        (byDay[k] = byDay[k] || []).push(ev);
        d = addDays(d, 1);
      }
    });
  }

  function upcomingEvents() {
    var t = Date.now();
    return events.filter(function (ev) { return ev.end.getTime() > t; });
  }

  function stateOf(startMs, endMs, t) {
    return t < startMs ? 'upcoming' : (t < endMs ? 'live' : 'ended');
  }

  function remaining(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return {
      d: String(Math.floor(s / 86400)),
      h: pad(Math.floor((s % 86400) / 3600)),
      m: pad(Math.floor((s % 3600) / 60)),
      s: pad(s % 60)
    };
  }

  /* ---------- Google Calendar ---------- */

  function gcalUrl(ev) {
    function stamp(d) {
      return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
        (ev.allDay ? '' : 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00');
    }
    var details = [ev.description, ev.organizer ? 'Organizer: ' + ev.organizer : '', ev.link]
      .filter(Boolean).join('\n\n');
    var params = new URLSearchParams({
      action: 'TEMPLATE',
      text: ev.title,
      dates: stamp(ev.start) + '/' + stamp(ev.end),   // all-day end is exclusive, as Google expects
      details: details,
      location: ev.location,
      ctz: CONFIG.timeZone
    });
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }

  /* ---------- Calendar ---------- */

  function renderCalendar() {
    var y = state.viewYear, m = state.viewMonth;
    ui.month.textContent = MONTHS[m] + ' ' + y;

    var first = new Date(y, m, 1).getDay();
    var total = new Date(y, m + 1, 0).getDate();
    var todayKey = dateKey(new Date());
    var html = '';

    for (var b = 0; b < first; b++) html += '<span class="ec-cell is-blank" aria-hidden="true"></span>';

    for (var d = 1; d <= total; d++) {
      var key = y + '-' + pad(m + 1) + '-' + pad(d);
      var list = byDay[key] || [];
      var cls = ['ec-cell'];
      if (list.length) cls.push('has-events');
      if (list.length > 1) cls.push('has-many');
      if (key === todayKey) cls.push('is-today');
      if (key === state.selectedKey) cls.push('is-selected');
      var label = MONTHS[m] + ' ' + d + ', ' + y +
        (list.length ? ', ' + list.length + ' event' + (list.length > 1 ? 's' : '') : '');
      html += '<button type="button" class="' + cls.join(' ') + '" data-key="' + key + '"' +
        ' aria-label="' + esc(label) + '"' + (key === state.selectedKey ? ' aria-pressed="true"' : '') + '>' +
        '<span class="ec-num">' + d + '</span>' +
        (list.length ? '<span class="ec-dot" aria-hidden="true"></span>' : '') +
        '</button>';
    }

    ui.grid.innerHTML = html;
    renderDayPanel();
  }

  function renderDayPanel() {
    if (!state.selectedKey) {
      ui.panel.innerHTML = '<p class="ec-hint">Select a highlighted date to see its events and activities.</p>';
      return;
    }
    var heading = '<h4 class="ec-panel-title">' + esc(fmtLong(keyToDate(state.selectedKey))) + '</h4>';
    var list = byDay[state.selectedKey] || [];
    if (!list.length) {
      ui.panel.innerHTML = heading + '<p class="ec-hint">No events scheduled for this day.</p>';
      return;
    }
    ui.panel.innerHTML = heading + '<ul class="ec-day-list">' + list.map(function (ev, i) {
      return '<li><button type="button" class="ec-day-item" data-index="' + i + '">' +
        '<span class="ec-day-time">' + esc(timeLabel(ev)) + '</span>' +
        '<span class="ec-day-title">' + esc(ev.title) + '</span></button></li>';
    }).join('') + '</ul>';
  }

  function shiftMonth(n) {
    var d = new Date(state.viewYear, state.viewMonth + n, 1);
    state.viewYear = d.getFullYear();
    state.viewMonth = d.getMonth();
    renderCalendar();
  }

  function pickDay(key) {
    state.selectedKey = key;
    renderCalendar();
    var cell = ui.grid.querySelector('[data-key="' + key + '"]');
    var list = byDay[key];
    if (list && list.length) openDetail(list, 0, cell);
    else if (cell) cell.focus();
  }

  /* ---------- Upcoming section ---------- */

  function countdownHTML(st, startMs, t) {
    if (st === 'live') return '<span class="ec-live">Happening now</span>';
    var r = remaining(startMs - t);
    return '<span><b data-u="d">' + r.d + '</b>days</span>' +
      '<span><b data-u="h">' + r.h + '</b>hrs</span>' +
      '<span><b data-u="m">' + r.m + '</b>min</span>' +
      '<span><b data-u="s">' + r.s + '</b>sec</span>';
  }

  function renderUpcoming() {
    var section = document.querySelector(CONFIG.upcomingSelector);
    if (!section) return;
    var body = section.querySelector('.ec-up-body') || section;
    var t = Date.now();
    var list = upcomingEvents();

    if (!list.length) {
      body.innerHTML = '<p class="ec-hint">No upcoming events or activities right now. Please check back soon.</p>';
      return;
    }

    body.innerHTML = '<ul class="ec-up-list">' + list.map(function (ev) {
      var startMs = ev.start.getTime(), endMs = ev.end.getTime();
      var st = stateOf(startMs, endMs, t);
      return '<li class="ec-up-card" data-state="' + st + '" data-start="' + startMs + '" data-end="' + endMs + '">' +
        '<div class="ec-up-date" aria-hidden="true">' +
          '<span class="ec-up-mon">' + MONTHS[ev.start.getMonth()].slice(0, 3) + '</span>' +
          '<span class="ec-up-day">' + ev.start.getDate() + '</span>' +
        '</div>' +
        '<div class="ec-up-main">' +
          '<h4 class="ec-up-title">' + esc(ev.title) + '</h4>' +
          '<p class="ec-up-meta">' + esc(dateLabel(ev)) + ' · ' + esc(timeLabel(ev)) +
            (ev.location ? ' · ' + esc(ev.location) : '') + '</p>' +
          '<div class="ec-units">' + countdownHTML(st, startMs, t) + '</div>' +
        '</div>' +
        '<div class="ec-up-actions">' +
          '<button type="button" class="ec-btn" data-ec-view="' + esc(ev.id) + '">View details</button>' +
          '<a class="ec-btn ec-btn-primary" href="' + esc(gcalUrl(ev)) + '" target="_blank" rel="noopener">Add to Google Calendar</a>' +
        '</div>' +
      '</li>';
    }).join('') + '</ul>';
  }

  /* Updates countdowns once per second. Re-renders only when an event starts or ends. */
  function tick() {
    var t = Date.now(), changed = false;
    document.querySelectorAll('.ec-up-card').forEach(function (card) {
      var startMs = +card.getAttribute('data-start'), endMs = +card.getAttribute('data-end');
      var st = stateOf(startMs, endMs, t);
      if (st !== card.getAttribute('data-state')) { changed = true; return; }
      if (st === 'upcoming') {
        var r = remaining(startMs - t);
        ['d', 'h', 'm', 's'].forEach(function (u) {
          var el = card.querySelector('[data-u="' + u + '"]');
          if (el && el.textContent !== r[u]) el.textContent = r[u];
        });
      }
    });
    if (changed) renderUpcoming();
  }

  /* ---------- Event details ---------- */

  function setRow(row, el, value) {
    row.hidden = !value;
    el.textContent = value || '';
  }

  function renderDetail() {
    var ev = state.detailList[state.detailIndex];
    if (!ev) return;

    ui.detailTitle.textContent = ev.title;
    ui.detailDate.textContent = dateLabel(ev);
    ui.detailTime.textContent = timeLabel(ev);
    setRow(ui.detailLocRow, ui.detailLoc, ev.location);
    setRow(ui.detailOrgRow, ui.detailOrg, ev.organizer);

    ui.detailDesc.textContent = ev.description;
    ui.detailDesc.hidden = !ev.description;

    var imgs = [ev.image].concat(ev.images).map(function (i) {
      return typeof i === 'string' ? i : (i && i.src);
    }).filter(Boolean).filter(function (src, idx, arr) { return arr.indexOf(src) === idx; });

    ui.detailMedia.hidden = !imgs.length;
    if (imgs.length) {
      ui.detailImg.src = imgs[0];
      ui.detailImg.alt = ev.title;
    }

    var extra = '';
    if (imgs.length > 1) {
      extra += '<div class="ec-gallery">' + imgs.slice(1).map(function (src) {
        return '<img src="' + esc(src) + '" alt="" loading="lazy">';
      }).join('') + '</div>';
    }
    if (/^https?:\/\//i.test(ev.link)) {
      extra += '<p><a class="ec-btn" href="' + esc(ev.link) + '" target="_blank" rel="noopener">More information</a></p>';
    }
    ui.detailExtra.innerHTML = extra;

    var n = state.detailList.length;
    ui.pager.hidden = n < 2;
    ui.pagerCount.textContent = (state.detailIndex + 1) + ' of ' + n;
    ui.prevEv.disabled = state.detailIndex === 0;
    ui.nextEv.disabled = state.detailIndex === n - 1;

    ui.gcal.href = gcalUrl(ev);
    ui.gcal.setAttribute('aria-label', 'Add ' + ev.title + ' to Google Calendar');

    ui.detailBody.classList.remove('is-swap');
    void ui.detailBody.offsetWidth;
    ui.detailBody.classList.add('is-swap');
  }

  function step(dir) {
    var next = state.detailIndex + dir;
    if (next < 0 || next >= state.detailList.length) return;
    state.detailIndex = next;
    renderDetail();
    ui.detailTitle.focus({ preventScroll: true });
  }

  /* ---------- Modal layers ---------- */

  function setOpen(name, value) {
    isOpen[name] = value;
    // Lock background scrolling while any modal is open.
    document.documentElement.classList.toggle('ec-lock', isOpen.calendar || isOpen.detail);
  }

  function showLayer(name, el, focusEl) {
    clearTimeout(el._closeTimer);
    el.hidden = false;
    el.classList.remove('is-closing');
    void el.offsetWidth;                 // restart the transition from the hidden state
    el.classList.add('is-open');
    setOpen(name, true);
    setTimeout(function () {
      if (focusEl) focusEl.focus({ preventScroll: true });
    }, reduceMotion ? 0 : 80);
  }

  function hideLayer(name, el, done) {
    if (!isOpen[name]) return;
    setOpen(name, false);
    el.classList.remove('is-open');
    el.classList.add('is-closing');
    clearTimeout(el._closeTimer);
    el._closeTimer = setTimeout(function () {
      el.hidden = true;
      el.classList.remove('is-closing');
      if (done) done();
    }, reduceMotion ? 0 : 240);
  }

  function openCalendar(trigger) {
    state.calendarTrigger = trigger || null;
    renderCalendar();                    // keeps the current month and selected date
    showLayer('calendar', ui.calendar, ui.calClose);
  }

  function closeCalendar() {
    hideLayer('calendar', ui.calendar, function () {
      if (state.calendarTrigger) state.calendarTrigger.focus({ preventScroll: true });
    });
  }

  function openDetail(list, index, returnEl) {
    state.detailList = list;
    state.detailIndex = index || 0;
    state.returnFocus = returnEl || document.activeElement;
    renderDetail();
    showLayer('detail', ui.detail, ui.detailClose);
  }

  function closeDetail() {
    hideLayer('detail', ui.detail, function () {
      // Return focus to the date or card that opened the details. Calendar state is untouched.
      var r = state.returnFocus;
      if (r && document.body.contains(r)) r.focus({ preventScroll: true });
    });
  }

  function trapFocus(e, root) {
    var items = Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (el) {
      return el.getClientRects().length > 0;
    });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1], active = document.activeElement;
    if (e.shiftKey && (active === first || !root.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !root.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ---------- Build and bind ---------- */

  function buildLayers() {
    var holder = document.createElement('div');
    holder.innerHTML = CALENDAR_HTML + DETAIL_HTML;
    while (holder.firstChild) document.body.appendChild(holder.firstChild);

    var $ = function (id) { return document.getElementById(id); };
    var c = $('ec-calendar'), d = $('ec-detail');
    ui = {
      calendar: c,
      calClose: c.querySelector('[data-ec-close]'),
      prev: $('ec-prev'),
      next: $('ec-next'),
      today: $('ec-today'),
      month: $('ec-month'),
      grid: $('ec-grid'),
      panel: $('ec-panel'),

      detail: d,
      detailClose: d.querySelector('[data-ec-close]'),
      detailBody: $('ec-detail-body'),
      detailTitle: $('ec-detail-title'),
      detailDate: $('ec-detail-date'),
      detailTime: $('ec-detail-time'),
      detailLocRow: $('ec-detail-loc-row'),
      detailLoc: $('ec-detail-loc'),
      detailOrgRow: $('ec-detail-org-row'),
      detailOrg: $('ec-detail-org'),
      detailDesc: $('ec-detail-desc'),
      detailMedia: $('ec-detail-media'),
      detailImg: $('ec-detail-img'),
      detailExtra: $('ec-detail-extra'),
      pager: $('ec-pager'),
      pagerCount: $('ec-pager-count'),
      prevEv: $('ec-prev-ev'),
      nextEv: $('ec-next-ev'),
      gcal: $('ec-gcal')
    };
  }

  function bind() {
    var list = document.querySelector('main .event-list');
    var trigger = document.querySelector(CONFIG.triggerSelector);
    var upBox = document.querySelector(CONFIG.upcomingSelector);

    // Upcoming section: create it if the page does not have one yet.
    // Order inside it: heading, then the See Events button, then the event cards.
    if (!upBox && (list || trigger)) {
      upBox = document.createElement('section');
      upBox.className = 'ec-upcoming';
      upBox.setAttribute('data-upcoming-events', '');
      upBox.setAttribute('aria-labelledby', 'ec-upcoming-title');
      upBox.innerHTML =
        '<div class="ec-up-head"><h3 id="ec-upcoming-title">Upcoming Events &amp; Activities</h3></div>' +
        '<div class="ec-up-body"></div>';
      if (list) list.parentNode.insertBefore(upBox, list);
      else trigger.parentNode.insertBefore(upBox, trigger.nextSibling);
    }

    // Trigger: use the page's button, or create one. It always lives under the heading.
    if (!trigger && upBox) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'ec-btn ec-btn-primary ec-see-all';
      trigger.textContent = 'See Events / Activities';
    }
    if (trigger && upBox) {
      var head = upBox.querySelector('.ec-up-head');
      var body = upBox.querySelector('.ec-up-body');
      if (head) head.appendChild(trigger);
      else upBox.insertBefore(trigger, body || upBox.firstChild);
    }

    if (trigger) trigger.addEventListener('click', function () { openCalendar(trigger); });

    if (upBox) {
      upBox.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-ec-view]');
        if (!btn) return;
        var id = btn.getAttribute('data-ec-view');
        var list2 = upcomingEvents();
        var idx = list2.findIndex(function (ev) { return ev.id === id; });
        if (idx > -1) openDetail(list2, idx, btn);
      });
    }

    ui.grid.addEventListener('click', function (e) {
      var cell = e.target.closest('.ec-cell');
      if (!cell || cell.classList.contains('is-blank')) return;
      pickDay(cell.getAttribute('data-key'));
    });

    ui.panel.addEventListener('click', function (e) {
      var item = e.target.closest('.ec-day-item');
      if (!item || !state.selectedKey) return;
      openDetail(byDay[state.selectedKey] || [], +item.getAttribute('data-index'), item);
    });

    ui.prev.addEventListener('click', function () { shiftMonth(-1); });
    ui.next.addEventListener('click', function () { shiftMonth(1); });
    ui.today.addEventListener('click', function () {
      var now = new Date();
      state.viewYear = now.getFullYear();
      state.viewMonth = now.getMonth();
      renderCalendar();
    });

    // Clicking the dark backdrop closes the modal. Clicks inside the dialog do not.
    ui.calendar.addEventListener('click', function (e) {
      if (e.target === ui.calendar || e.target.closest('[data-ec-close]')) closeCalendar();
    });

    ui.detail.addEventListener('click', function (e) {
      if (e.target === ui.detail || e.target.closest('[data-ec-close]')) { closeDetail(); return; }
      var stepBtn = e.target.closest('[data-ec-step]');
      if (stepBtn) step(+stepBtn.getAttribute('data-ec-step'));
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (isOpen.detail) { e.preventDefault(); closeDetail(); }
        else if (isOpen.calendar) { e.preventDefault(); closeCalendar(); }
      } else if (e.key === 'Tab') {
        if (isOpen.detail) trapFocus(e, ui.detail);
        else if (isOpen.calendar) trapFocus(e, ui.calendar);
      }
    });
  }

  function init() {
    buildData();
    buildLayers();
    bind();
    renderUpcoming();
    setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();