(function () {
  'use strict';

  var root = document.documentElement;
  var SECTIONS = 'main > .page';

  /* Elements that reveal individually. */
  var SINGLE = [
    SECTIONS + ' .hero-copy',
    SECTIONS + ' .page-head',
    SECTIONS + ' .tabs',
    SECTIONS + ' .toolbar',
    SECTIONS + ' .about-card',
    SECTIONS + ' .about-photo',
    SECTIONS + ' .batch-photo',
    SECTIONS + ' .batch-head',
    SECTIONS + ' .contact-form',
    '.site-footer .footer-grid',
  ];

  /* Containers whose direct children reveal in a staggered sequence. */
  var GROUPS = [
    SECTIONS + ' .feature-strip',
    SECTIONS + ' .grid',
    SECTIONS + ' .event-list',
    SECTIONS + ' .ann-list',
    SECTIONS + ' .contact-list',
  ];

  var MAX_STAGGER = 6; /* Later items share the same delay, so long lists stay quick. */

  /* No IntersectionObserver: show everything rather than hide it. */
  if (!('IntersectionObserver' in window)) {
    root.classList.remove('js');
    return;
  }

  /* Reduced motion: nothing is hidden in the first place (see animations.css). */
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  function show(el, animate) {
    if (animate) el.classList.add('rv-anim');
    el.classList.add('is-visible');
    var group = el.parentElement;
    if (group && group.hasAttribute('data-rv-group')) {
      group.setAttribute('data-rv-seen', '');
    }
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      show(entry.target, true);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  /* Finds new elements and registers them. Already-registered elements are skipped. */
  function prepare() {
    document.querySelectorAll(SINGLE.join(',')).forEach(function (el) {
      if (el.hasAttribute('data-rv')) return;
      el.setAttribute('data-rv', '');
      io.observe(el);
    });

    document.querySelectorAll(GROUPS.join(',')).forEach(function (group) {
      group.setAttribute('data-rv-group', '');
      /* A group that has already revealed shows new children at once (for example
         after a filter or search), so typing or filtering does not replay animations. */
      var seen = group.hasAttribute('data-rv-seen');
      Array.prototype.forEach.call(group.children, function (child, i) {
        if (child.hasAttribute('data-rv')) return;
        child.setAttribute('data-rv', '');
        child.style.setProperty('--rv-i', Math.min(i, MAX_STAGGER));
        if (seen) show(child, false);
        else io.observe(child);
      });
    });
  }

  /* script.js re-renders sections with innerHTML. Batch those changes into one scan per frame. */
  var scheduled = false;
  var mo = new MutationObserver(function () {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      prepare();
    });
  });

  var main = document.querySelector('main');
  if (main) mo.observe(main, { childList: true, subtree: true });

  prepare();
})();