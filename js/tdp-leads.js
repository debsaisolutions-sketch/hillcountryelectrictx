/* TradeDeskPro first-touch/UTM capture */
(function () {
  if (typeof document === 'undefined') return;
  var s = document.createElement('script');
  s.src = 'https://www.tradedeskpro.com/js/tdp-lead-attribution.js';
  s.defer = true;
  (document.head || document.documentElement).appendChild(s);
})();

/**
 * Lead intake for txhillcountryelectric.com → TradeDeskPro /api/leads.
 * No client secrets. Origin allowlist is enforced by the API.
 */
(function () {
  var API_URL = 'https://www.tradedeskpro.com/api/leads';
  var PROFILE_ID = '63e7470e-fe1e-4367-aae0-56d0d6392d78';
  var SOURCE = 'txhillcountryelectric.com';
  var PHONE_FALLBACK = '(830) 381-0395';
  var MIN_FILL_MS = 3000;
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var loadedAt = Date.now();

  function field(form, name) {
    var el = form.querySelector('[name="' + name + '"]');
    return el ? String(el.value || '').trim() : '';
  }

  function buildMessage(form) {
    var lines = [];
    var service = field(form, 'service');
    var area = field(form, 'area');
    var details = field(form, 'message') || field(form, 'details');
    if (service) lines.push('Service: ' + service);
    if (area) lines.push('Area: ' + area);
    if (details) lines.push(details);
    return lines.join('\n');
  }

  function provenance() {
    var fields = {};
    try {
      if (typeof window.tdpLeadAttribution === 'function') {
        var extra = window.tdpLeadAttribution() || {};
        var keys = ['landing_url', 'first_touch_url'].concat(UTM_KEYS);
        for (var i = 0; i < keys.length; i++) {
          if (extra[keys[i]]) fields[keys[i]] = extra[keys[i]];
        }
      }
    } catch (e) {}
    try {
      var params = new URLSearchParams(window.location.search);
      for (var j = 0; j < UTM_KEYS.length; j++) {
        var k = UTM_KEYS[j];
        if (!fields[k] && params.get(k)) fields[k] = params.get(k);
      }
    } catch (e2) {}
    fields.landing_url = window.location.href;
    return fields;
  }

  function statusEl(form) {
    var el = form.querySelector('.form-status');
    if (!el) {
      el = document.createElement('p');
      el.className = 'form-status';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      form.appendChild(el);
    }
    return el;
  }

  function showStatus(form, ok, text) {
    var el = statusEl(form);
    el.textContent = text;
    el.style.color = ok ? '#166534' : '#991b1b';
    el.style.display = 'block';
  }

  function successCopy() {
    return "Thanks — we received your request and will contact you within 1 hour during business hours.";
  }

  function errorCopy() {
    return "We couldn't send your request. Please call " + PHONE_FALLBACK + " and we'll help right away.";
  }

  function fakeSuccess(form) {
    showStatus(form, true, successCopy());
    if (typeof form.reset === 'function') form.reset();
  }

  function wireForm(form) {
    if (!form || form.dataset.tdpWired === '1') return;
    form.dataset.tdpWired = '1';
    form.removeAttribute('action');
    form.removeAttribute('method');

    if (!form.querySelector('[name="company_website"]')) {
      var hp = document.createElement('input');
      hp.type = 'text';
      hp.name = 'company_website';
      hp.tabIndex = -1;
      hp.autocomplete = 'off';
      hp.setAttribute('aria-hidden', 'true');
      hp.className = 'hp-field';
      form.appendChild(hp);
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (field(form, 'company_website')) {
        fakeSuccess(form);
        return;
      }
      if (Date.now() - loadedAt < MIN_FILL_MS) {
        fakeSuccess(form);
        return;
      }

      var name = field(form, 'name');
      var phone = field(form, 'phone');
      var email = field(form, 'email');
      if (!name || !phone) {
        showStatus(form, false, 'Please enter your name and phone number, or call ' + PHONE_FALLBACK + '.');
        return;
      }

      var btn = form.querySelector('button[type="submit"], button:not([type])');
      var original = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sending...';
      }

      var body = {
        name: name,
        phone: phone,
        email: email,
        message: buildMessage(form),
        source: SOURCE,
        profile_id: PROFILE_ID,
      };
      var extra = provenance();
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key) && extra[key]) body[key] = extra[key];
      }

      try {
        var res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          showStatus(form, true, successCopy());
          if (typeof form.reset === 'function') form.reset();
        } else {
          showStatus(form, false, errorCopy());
        }
      } catch (err) {
        showStatus(form, false, errorCopy());
      }

      if (btn) {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }

  function init() {
    document.querySelectorAll('form').forEach(wireForm);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
