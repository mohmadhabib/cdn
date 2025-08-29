/* realtime.js — Browser/ESM client for realtime.php backend */
export default class Realtime {
  /**
   * @param {string} endpoint Full URL to realtime.php (no query string)
   * @param {RequestInit} [opts] fetch options (e.g., credentials:'include')
   */
  constructor(endpoint, opts = {}) {
    this.base = endpoint.replace(/\/+$/, '');           // trim trailing slashes
    this.fetchOpts = { credentials: 'include', ...opts }; // keep PHP session
  }

  /* ---------- AUTH ---------- */
  async register(email, pass) {
    return this._post('register', { email, pass });
  }

  async login(email, pass) {
    return this._post('login', { email, pass });
  }

  async logout() {
    return this._post('logout', {});
  }

  /* ---------- DATA ---------- */
  /** Write a JS value (object, array, primitive) at an arbitrary path */
  async set(path, data) {
    return this._post('set', {
      path,
      data: JSON.stringify(data)
    });
  }

  /** Read the value stored at `path` (returns parsed JSON or null) */
  async get(path) {
    const res = await this._get('get', { path });
    return res === '' ? null : JSON.parse(res);
  }

  /* ---------- INTERNAL HELPERS ---------- */
  async _post(act, body) {
    const resp = await fetch(`${this.base}?act=${act}`, {
      ...this.fetchOpts,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body)
    });
    return resp.ok ? resp.json() : Promise.reject(await resp.text());
  }

  async _get(act, qs) {
    const url = new URL(this.base);
    url.searchParams.set('act', act);
    Object.entries(qs).forEach(([k, v]) => url.searchParams.set(k, v));
    const resp = await fetch(url, this.fetchOpts);
    return resp.ok ? resp.text() : Promise.reject(await resp.text());
  }
}
