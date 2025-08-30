// mini-pb.js — JavaScript client for the single-file PHP backend

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
    // Optional hooks
    this.beforeSend = (url, options) => ({ url, options });
    this.afterSend = async (response, data) => data;
  }

  // ---------- Low-level send ----------
  async send(path, { method = "GET", headers = {}, query, body, asForm = false, credentials = "include" } = {}) {
    const url = new URL(this.baseUrl + path);
    if (query && typeof query === "object") {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }

    const opts = { method, headers: { ...headers }, credentials };

    // Authorization
    if (this.authStore.token) {
      opts.headers["Authorization"] = `Bearer ${this.authStore.token}`; // add bearer token [4][2]
    }

    // Body handling
    if (body !== undefined && body !== null) {
      if (asForm === true) {
        opts.body = body; // FormData or URLSearchParams; do not set Content-Type manually
      } else {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
      }
    }

    // Hooks
    const { url: finalUrl, options } = this.beforeSend(url.toString(), opts);

    const res = await fetch(finalUrl, options); // Fetch API usage [7]
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

  async register(email, password) {
    return this.send("/api/auth/register", {
      method: "POST",
      body: { email, password },
    });
  }

  // ---------- Records ----------
  /**
   * List records.
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
   * Create a record. Accepts a plain object (JSON) or FormData.
   */
  async create(name, data, { form = false } = {}) {
    return this.send(`/api/collections/${encodeURIComponent(name)}/records`, {
      method: "POST",
      body: data,
      asForm: form,
    });
  }

  /**
   * Update a record by id (partial update).
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
   * Upload a file; defaults to public.
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
   * Build a file URL; for private files, direct <img> tags won't send auth headers.
   */
  fileUrl(storedName) {
    return `${this.baseUrl}/files/${encodeURIComponent(storedName)}`;
  }

  // ---------- Admin: Collections (requires admin token) ----------
  /**
   * Create a collection.
   * Server UI route expects form data; this supports both FormData and JSON.
   * @param {string} name
   * @param {Array<{name:string,type?:'TEXT'|'INTEGER'|'REAL'|'BLOB',required?:boolean,unique?:boolean}>} schema
   * @param {{useForm?: boolean}} opts
   */
  async createCollection(name, schema = [], opts = {}) {
    const useForm = !!opts.useForm;
    if (useForm) {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("schema", JSON.stringify(schema));
      return this.send("/admin/collections/new", {
        method: "POST",
        asForm: true,
        body: fd,
        // Many servers respond with HTML/redirects on admin routes; Accept header can hint JSON
        headers: { Accept: "application/json, text/html;q=0.8" },
      });
    } else {
      // Works only if the server treats JSON in this route; otherwise prefer useForm: true
      return this.send("/admin/collections/new", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: { name, schema },
      });
    }
  }

  /**
   * Update a collection (rename and/or schema).
   * @param {string} currentName
   * @param {{name?: string, schema?: Array}} changes
   * @param {{useForm?: boolean}} opts
   */
  async updateCollection(currentName, changes = {}, opts = {}) {
    const nextName = changes.name ?? currentName;
    const schema = Array.isArray(changes.schema) ? changes.schema : undefined;
    const useForm = !!opts.useForm;

    if (useForm) {
      const fd = new FormData();
      fd.append("name", nextName);
      if (schema) fd.append("schema", JSON.stringify(schema));
      return this.send(`/admin/collections/${encodeURIComponent(currentName)}/edit`, {
        method: "POST",
        asForm: true,
        body: fd,
        headers: { Accept: "application/json, text/html;q=0.8" },
      });
    } else {
      return this.send(`/admin/collections/${encodeURIComponent(currentName)}/edit`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: { name: nextName, schema },
      });
    }
  }

  /**
   * Delete a collection.
   * @param {string} name
   */
  async deleteCollection(name) {
    return this.send(`/admin/collections/${encodeURIComponent(name)}/delete`, {
      method: "POST",
      headers: { Accept: "application/json, text/html;q=0.8" },
    });
    // Note: Server may issue 302 redirect for HTML flows; fetch follows automatically.
  }
}
