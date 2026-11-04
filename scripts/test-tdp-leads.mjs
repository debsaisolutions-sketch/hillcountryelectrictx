/**
 * Local test for js/tdp-leads.js with a mocked fetch.
 * Does not call TradeDeskPro.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const scriptPath = fileURLToPath(new URL('../js/tdp-leads.js', import.meta.url));
const scriptSource = readFileSync(scriptPath, 'utf8');
const PHONE = '(830) 381-0395';
const PROFILE_ID = '63e7470e-fe1e-4367-aae0-56d0d6392d78';

class El {
  constructor(tag) {
    this.tagName = String(tag || '').toUpperCase();
    this.children = [];
    this.attrs = {};
    this.listeners = {};
    this.style = {};
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.className = '';
    this.name = '';
    this.type = '';
    this.dataset = {};
    this.parentNode = null;
    this.autocomplete = '';
    this.tabIndex = 0;
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
    if (name === 'name') this.name = String(value);
    if (name === 'type') this.type = String(value);
    if (name === 'class') this.className = String(value);
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
  }

  removeAttribute(name) {
    delete this.attrs[name];
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    const all = [];
    const walk = (node) => {
      all.push(node);
      node.children.forEach(walk);
    };
    walk(this);
    return all.filter((node) => matches(node, sel));
  }

  reset() {
    const walk = (node) => {
      if ('value' in node && node.tagName !== 'FORM') node.value = '';
      node.children.forEach(walk);
    };
    this.children.forEach(walk);
  }
}

function matches(node, sel) {
  return sel.split(',').some((part) => matchesOne(node, part.trim()));
}

function matchesOne(node, sel) {
  if (sel === 'form') return node.tagName === 'FORM';
  if (sel.startsWith('.')) return node.className.split(/\s+/).includes(sel.slice(1));
  const attr = sel.match(/^\[name="([^"]+)"\]$/);
  if (attr) return node.name === attr[1] || node.getAttribute('name') === attr[1];
  if (sel === 'button[type="submit"]') {
    return node.tagName === 'BUTTON' && (node.type === 'submit' || node.getAttribute('type') === 'submit');
  }
  if (sel === 'button:not([type])') return node.tagName === 'BUTTON' && !node.getAttribute('type');
  return false;
}

function makeForm() {
  const form = new El('form');
  form.tagName = 'FORM';
  const add = (tag, attrs, text) => {
    const el = new El(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (text) el.textContent = text;
    form.appendChild(el);
    return el;
  };
  add('input', { name: 'name', type: 'text' });
  add('input', { name: 'email', type: 'email' });
  add('input', { name: 'phone', type: 'tel' });
  add('input', { name: 'service', type: 'text' });
  add('input', { name: 'area', type: 'text' });
  add('textarea', { name: 'message' });
  add('input', { name: 'company_website', type: 'text' });
  add('button', { type: 'submit' }, 'Request Free Estimate');
  add('p', { class: 'form-status' });
  const status = form.querySelector('.form-status');
  status.className = 'form-status';
  return form;
}

function load(form, nowValues) {
  let nowIndex = 0;
  const calls = [];
  let fetchImpl = async () => ({ ok: true, status: 201 });
  const document = new El('html');
  document.head = new El('head');
  document.body = new El('body');
  document.documentElement = document;
  document.readyState = 'complete';
  document.body.appendChild(form);
  document.createElement = (tag) => new El(tag);
  document.querySelectorAll = (sel) => document.body.querySelectorAll(sel).concat(document.head.querySelectorAll(sel));

  const window = {
    location: {
      href: 'https://txhillcountryelectric.com/?utm_source=google&utm_medium=cpc&utm_campaign=panel&utm_term=electrician&utm_content=ad1',
      search: '?utm_source=google&utm_medium=cpc&utm_campaign=panel&utm_term=electrician&utm_content=ad1',
    },
    tdpLeadAttribution() {
      return {
        landing_url: 'https://txhillcountryelectric.com/landing',
        first_touch_url: 'https://txhillcountryelectric.com/first',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'panel',
        utm_term: 'electrician',
        utm_content: 'ad1',
      };
    },
    document,
    Date: {
      now() {
        const value = nowValues[Math.min(nowIndex, nowValues.length - 1)];
        nowIndex += 1;
        return value;
      },
    },
    URLSearchParams,
    fetch(url, init) {
      calls.push({ url, init });
      return fetchImpl(url, init);
    },
  };
  window.window = window;

  vm.runInNewContext(scriptSource, window, { filename: 'tdp-leads.js' });
  const handler = form.listeners.submit && form.listeners.submit[0];
  if (!handler) throw new Error('submit handler was not wired');
  return {
    calls,
    handler,
    setFetch(fn) {
      fetchImpl = fn;
    },
  };
}

function setValues(form, values) {
  Object.entries(values).forEach(([name, value]) => {
    const el = form.querySelector(`[name="${name}"]`);
    if (!el) throw new Error(`missing field ${name}`);
    el.value = value;
  });
}

function statusText(form) {
  return form.querySelector('.form-status').textContent;
}

let passed = 0;
function assert(cond, message) {
  if (!cond) throw new Error(message);
  passed += 1;
}

async function testSuccess(status) {
  const form = makeForm();
  const harness = load(form, [1_000, 5_000]);
  setValues(form, {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '830-381-0400',
    service: 'Panel Upgrades',
    area: 'Kerrville',
    message: 'Breaker keeps tripping',
  });
  let seenDisabled = false;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  harness.setFetch(() => {
    const btn = form.querySelector('button[type="submit"]');
    seenDisabled = btn.disabled && btn.textContent === 'Sending...';
    return gate.then(() => ({ ok: true, status }));
  });
  const pending = harness.handler({ preventDefault() {} });
  assert(harness.calls.length === 1, `${status}: fetch was not called`);
  assert(seenDisabled, `${status}: button was not disabled while sending`);
  const { url, init } = harness.calls[0];
  assert(url === 'https://www.tradedeskpro.com/api/leads', 'wrong API url');
  assert(init.method === 'POST', 'method is not POST');
  assert(init.headers['Content-Type'] === 'application/json', 'content type');
  assert(!JSON.stringify(init.headers).includes('Lead-Secret'), 'secret header leaked');
  const body = JSON.parse(init.body);
  assert(body.name === 'Ada Lovelace', 'name');
  assert(body.phone === '830-381-0400', 'phone');
  assert(body.email === 'ada@example.com', 'email');
  assert(body.profile_id === PROFILE_ID, 'profile id');
  assert(body.source === 'txhillcountryelectric.com', 'source domain');
  assert(body.message === 'Service: Panel Upgrades\nArea: Kerrville\nBreaker keeps tripping', 'message fold');
  assert(
    body.landing_url ===
      'https://txhillcountryelectric.com/?utm_source=google&utm_medium=cpc&utm_campaign=panel&utm_term=electrician&utm_content=ad1',
    'landing_url'
  );
  assert(body.first_touch_url === 'https://txhillcountryelectric.com/first', 'first touch');
  assert(body.utm_source === 'google' && body.utm_medium === 'cpc' && body.utm_campaign === 'panel', 'utm');
  assert(body.utm_term === 'electrician' && body.utm_content === 'ad1', 'utm term/content');
  release();
  await pending;
  assert(statusText(form).includes('received your request'), `${status}: success copy`);
  assert(!statusText(form).includes(PHONE) || status === 'error', `${status}: success should not be the phone fallback`);
  assert(form.querySelector('[name="name"]').value === '', `${status}: form was not reset`);
  const btn = form.querySelector('button[type="submit"]');
  assert(btn.disabled === false && btn.textContent === 'Request Free Estimate', `${status}: button not restored`);
}

async function testFailure(status) {
  const form = makeForm();
  const harness = load(form, [1_000, 5_000]);
  setValues(form, { name: 'Grace Hopper', phone: '8303810395', email: 'grace@example.com', message: 'Outlets are dead' });
  harness.setFetch(async () => ({ ok: false, status }));
  await harness.handler({ preventDefault() {} });
  assert(harness.calls.length === 1, `${status}: expected a post`);
  const text = statusText(form);
  assert(text.includes(PHONE), `${status}: phone fallback missing`);
  assert(!text.includes('received your request'), `${status}: should not look successful`);
}

async function testNetworkError() {
  const form = makeForm();
  const harness = load(form, [1_000, 5_000]);
  setValues(form, { name: 'Grace Hopper', phone: '8303810395', message: 'No power' });
  harness.setFetch(async () => {
    throw new Error('offline');
  });
  await harness.handler({ preventDefault() {} });
  assert(statusText(form).includes(PHONE), 'network error should show the phone number');
}

async function testHoneypot() {
  const form = makeForm();
  const harness = load(form, [1_000, 9_000]);
  setValues(form, { name: 'Bot', phone: '8303810395', company_website: 'https://spam.example' });
  await harness.handler({ preventDefault() {} });
  assert(harness.calls.length === 0, 'honeypot should not post');
  assert(statusText(form).includes('received your request'), 'honeypot should look successful');
}

async function testTooFast() {
  const form = makeForm();
  const harness = load(form, [1_000, 2_000]);
  setValues(form, { name: 'Speedy', phone: '8303810395', message: 'Now' });
  await harness.handler({ preventDefault() {} });
  assert(harness.calls.length === 0, 'submit under 3s should not post');
  assert(statusText(form).includes('received your request'), 'fast submit should look successful');
}

async function testMissingPhone() {
  const form = makeForm();
  const harness = load(form, [1_000, 9_000]);
  setValues(form, { name: 'No Phone', phone: '   ', message: 'Help' });
  await harness.handler({ preventDefault() {} });
  assert(harness.calls.length === 0, 'missing phone should not post');
  assert(statusText(form).includes(PHONE), 'missing phone should offer the phone number');
}

await testSuccess(201);
await testSuccess(202);
await testFailure(403);
await testFailure(429);
await testFailure(500);
await testNetworkError();
await testHoneypot();
await testTooFast();
await testMissingPhone();

console.log(`tdp-leads mock fetch tests passed (${passed} assertions). No live lead posted.`);
