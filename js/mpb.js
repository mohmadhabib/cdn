// mini-pb.js
export class MiniPB {
  /**
   * @param {string} baseUrl e.g. "http://localhost:8080"
   */
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.authStore = {
      token: null,
      get isAuth() { return !!this.token; },
      clear: () => { this.token = null; },
    };
    // Hooks similar to PocketBase SDK style
    this.beforeSend = (url, options) => ({ url, options });
    this.afterSend = async (response, data) => data;
  }

  // ---------- Low-level send ----------
  async send(path, { method = "GET", headers = {}, query, body, asForm = false } = {}) {
    const url = new URL(this.baseUrl + path);
    if (query && typeof query === "object") {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }

    const opts = { method, headers: { ...headers } };

    // Authorization
    if (this.authStore.token) {
      opts.headers["Authorization"] = `Bearer ${this.authStore.token}`;
    }

    // Body handling
    if (body !== undefined && body !== null) {
      if (asForm === true) {
        // body should be FormData (for files) or URLSearchParams
        opts.body = body;
        // Let browser set Content-Type when FormData is used
      } else {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
      }
    }

    // Hooks
    const { url: finalUrl, options } = this.beforeSend(url.toString(), opts);

    const res = await fetch(finalUrl, options);
    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await res.json().catch(() => ({})) : await res.text();

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return this.afterSend(res, data);
  }

  // ---------- Auth ----------
  async login(email, password) {
    const out = await this.send("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (out?.token) this.authStore.token = out.token;
    return out;
  }

  logout() {
    this.authStore.clear();
  }

  // Optional self-register
  async register(email, password) {
    return this.send("/api/auth/register", {
      method: "POST",
      body: { email, password },
    });
  }

  // ---------- Collections ----------
  /**
   * List records with pagination and sorting.
   * @param {string} name collection name
   * @param {{limit?:number, offset?:number, sort?:string}} params
   */
  async list(name, params = {}) {
    return this.send(`/api/collections/${encodeURIComponent(name)}/records`, {
      method: "GET",
      query: params,
    });
  }

  /**
   * Get a single record by id.
   */
  async getOne(name, id) {
    return this.send(`/api/collections/${encodeURIComponent(name)}/records/${encodeURIComponent(id)}`, {
      method: "GET",
    });
  }

  /**
   * Create a record. Accepts either a plain object (JSON) or FormData.
   */
  async create(name, data, { form = false } = {}) {
    return this.send(`/api/collections/${encodeURIComponent(name)}/records`, {
      method: "POST",
      body: data,
      asForm: form,
    });
  }

  /**
   * Update a record by id. Partial update using JSON body.
   */
  async update(name, id, data) {
    return this.send(`/api/collections/${encodeURIComponent(name)}/records/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: data,
    });
  }

  /**
   * Delete a record by id.
   */
  async delete(name, id) {
    return this.send(`/api/collections/${encodeURIComponent(name)}/records/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  // ---------- Files ----------
  /**
   * Upload a file. By default public=1.
   * @param {File|Blob} file
   * @param {{public?: boolean}} options
   */
  async uploadFile(file, { public: isPublic = true } = {}) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("public", isPublic ? "1" : "0");
    return this.send("/api/files/upload", { method: "POST", asForm: true, body: fd });
  }

  /**
   * Build file URL for public/private file delivery.
   * Private files still require Authorization header when fetched programmatically.
   */
  fileUrl(storedName) {
    return `${this.baseUrl}/files/${encodeURIComponent(storedName)}`;
  }
}
