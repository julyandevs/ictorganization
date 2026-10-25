(function () {
  'use strict';

  var STORAGE_KEY = 'ict-org-site-v1';// must match STORAGE_KEY in script.js
  var VERIFY_DELAY_MS = 600;// short "checking" pause; a real request replaces it
  var SURNAME_MAX = 60;
  var SURNAME_PATTERN = /^\p{L}[\p{L} '’.-]*$/u;

  /* Compare surnames loosely: ignore case, accents, spaces, hyphens, apostrophes and periods. */
  function surnameKey(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
  }

  /* A member's surname: the "surname" field if set, otherwise the last word of "name". */
  function memberSurname(member) {
    if (member.surname) return String(member.surname);
    var words = String(member.name || '').trim().split(/\s+/);
    return words[words.length - 1] || '';
  }

  /* Same source order as the site's Store: saved dashboard data first, then content.js. */
  function loadMembers() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved) return Array.isArray(saved.members) ? saved.members : [];
    } catch (err) {
      console.error('Saved site data could not be read:', err);
    }
    var seed = (window.ICT_CONTENT && window.ICT_CONTENT.members) || [];
    return seed.map(function (m) { return Object.assign({ status: 'Active' }, m); });
  }

  /* Returns { status: 'verified' | 'inactive' | 'not-found', member? }. */
  function findMemberBySurname(surname) {
    var key = surnameKey(surname);
    if (!key) return { status: 'not-found' };
    var matches = loadMembers().filter(function (m) { return surnameKey(memberSurname(m)) === key; });
    if (!matches.length) return { status: 'not-found' };
    var active = matches.find(function (m) { return (m.status || 'Active') === 'Active'; });
    return active ? { status: 'verified', member: active } : { status: 'inactive' };
  }

  /* DEMO ONLY. Replace the body with a request to your secure backend, which checks
     the surname on the server and returns one of: 'verified', 'inactive', 'not-found'. */
  function checkSurname(surname) {
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(findMemberBySurname(surname)); }, VERIFY_DELAY_MS);
    });
  }

  /* Returns { value } when the input is acceptable, or { error } with a message. */
  function validateSurname(raw) {
    var value = String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
    if (!value) return { error: 'Please enter your registered surname.' };
    if (value.length > SURNAME_MAX) return { error: 'Surnames must be ' + SURNAME_MAX + ' characters or fewer.' };
    if (!SURNAME_PATTERN.test(value)) return { error: 'Use letters only. Hyphens, apostrophes, and periods are allowed.' };
    return { value: value };
  }

  window.ICTVerify = { validate: validateSurname, check: checkSurname };
})();