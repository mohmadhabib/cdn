/**
 * PBLite - Async JS wrapper for the updated PHP API.
 * Uses collection_name instead of IDs for CRUD.
 * Persistent token with auto refresh from X-New-Token header.
 */
class PBLite {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
        this.tokenKey = "pbl_token";
        this.token = localStorage.getItem(this.tokenKey) || null;
    }

    _post(action, data = {}) {
        if (this.token) data.token = this.token;
        return fetch(this.baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ action, ...data })
        }).then(res => {
            this._handleTokenRefresh(res);
            return res.json();
        });
    }

    _get(action, params = {}) {
        if (this.token) params.token = this.token;
        const url = new URL(this.baseUrl);
        url.search = new URLSearchParams({ action, ...params }).toString();
        return fetch(url, { method: "GET" }).then(res => {
            this._handleTokenRefresh(res);
            return res.json();
        });
    }

    _handleTokenRefresh(res) {
        const newToken = res.headers.get("X-New-Token");
        if (newToken) {
            console.log("🔄 Token auto-refreshed");
            this.setToken(newToken);
        }
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem(this.tokenKey, token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem(this.tokenKey);
    }

    /* ===== AUTH ===== */
    reg(u, p) {
        return this._post("register", { username: u, password: p });
    }
    login(u, p) {
        return this._post("login", { username: u, password: p }).then(res => {
            if (res.success && res.token) this.setToken(res.token);
            return res;
        });
    }
    logout() {
        this.clearToken();
        return { success: true };
    }
    passChange(newP) {
        return this._post("change_password", { new_password: newP });
    }

    /* ===== COLLECTIONS ===== */
    colAdd(name, pub = 0) {
        return this._post("create_collection", { name, public: +pub });
    }
    colUpdate(name, newName, pub = null) {
        const data = { name, new_name: newName };
        if (pub !== null) data.public = +pub;
        return this._post("update_collection", data);
    }
    colDelete(name) {
        return this._post("delete_collection", { name });
    }
    colList() {
        return this._get("list_collections");
    }

    /* ===== RECORDS ===== */
    recAdd(colName, obj) {
        return this._post("add_record", {
            collection_name: colName,
            data: JSON.stringify(obj)
        });
    }
    recUpdate(colName, id, obj) {
        return this._post("update_record", {
            collection_name: colName,
            record_id: id,
            data: JSON.stringify(obj)
        });
    }
    recDelete(colName, id) {
        return this._post("delete_record", {
            collection_name: colName,
            record_id: id
        });
    }
    recList(colName, search = "") {
        return this._get("list_records", { collection_name: colName, search });
    }
    recGet(id) {
        return this._get("get_record", { record_id: id });
    }
    /* ===== FILES ===== */
    fileUpload(file, collectionName = null) {
        const formData = new FormData();
        formData.append("action", "upload_file");
        if (this.token) formData.append("token", this.token);
        formData.append("file", file);
        if (collectionName) formData.append("collection_name", collectionName);

        return fetch(this.baseUrl, { method: "POST", body: formData }).then(
            res => {
                this._handleTokenRefresh(res);
                return res.json();
            }
        );
    }

    fileDownload(fileId) {
        const params = new URLSearchParams({
            action: "download_file",
            file_id: fileId
        });
        if (this.token) params.append("token", this.token);

        return fetch(`${this.baseUrl}?${params.toString()}`).then(res => {
            if (!res.ok) throw new Error("Download failed");
            this._handleTokenRefresh(res);
            return res.blob();
        });
    }

    fileDelete(fileId) {
        return this._post("delete_file", { file_id: fileId });
    }

    fileList() {
        return this._get("file_list");
    }
    /* ===== ADMIN ===== */
    admUsers() {
        return this._get("admin_list_users");
    }
    admDisable(id) {
        return this._post("admin_disable_user", { user_id: id });
    }
    admPromote(id) {
        return this._post("admin_promote_user", { user_id: id });
    }
    admCredit(id, credits) {
        return this._post("admin_add_credit", { user_id: id, credits });
    }
    admWipe(colId) {
        return this._post("admin_wipe_collection", { collection_id: colId });
    }
    admSetLimits(id, pm, pd, pmth) {
        return this._post("admin_set_user_limits", {
            user_id: id,
            per_minute: pm,
            per_day: pd,
            per_month: pmth
        });
    }
}
