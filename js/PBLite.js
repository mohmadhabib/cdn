/**
 * PBLite v2.1 - Improved CORS and authentication handling
 */
class PBLite {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
        this.tokenKey = "pbl_token";
        this.token = localStorage.getItem(this.tokenKey) || null;
        this.debug = false;
    }

    async _request(method, action, data = {}, isFileUpload = false) {
        const url = new URL(this.baseUrl);
        const options = { 
            method,
            mode: 'cors',
            credentials: 'omit'
        };
        
        // Add token to request if we have one
        if (this.token && this.token !== 'null' && this.token !== 'undefined') {
            if (isFileUpload) {
                if (data instanceof FormData) {
                    data.append("token", this.token);
                }
            } else {
                data.token = this.token;
            }
        }
        
        if (method === "GET") {
            url.searchParams.append("action", action);
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined) {
                    url.searchParams.append(key, value);
                }
            }
            
            if (this.debug) {
                console.log("GET Request:", url.toString());
            }
        } else {
            if (isFileUpload) {
                options.body = data;
                // FormData automatically sets Content-Type with boundary
            } else {
                const formData = new FormData();
                formData.append("action", action);
                for (const [key, value] of Object.entries(data)) {
                    if (value !== null && value !== undefined) {
                        formData.append(key, value);
                    }
                }
                options.body = formData;
            }
            
            if (this.debug) {
                console.log("POST Request:", action, data);
            }
        }
        
        try {
            const response = await fetch(method === "GET" ? url : this.baseUrl, options);
            
            // Handle token refresh
            const newToken = response.headers.get("X-New-Token");
            if (newToken) {
                console.log("🔄 Token auto-refreshed");
                this.setToken(newToken);
            }
            
            // Handle file downloads
            if (action === "download_file") {
                if (!response.ok) {
                    const errorText = await response.text();
                    try {
                        const errorJson = JSON.parse(errorText);
                        throw new Error(errorJson.error || "Download failed");
                    } catch {
                        throw new Error(errorText || "Download failed");
                    }
                }
                return await response.blob();
            }
            
            // Parse response
            const responseText = await response.text();
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${responseText}`);
            }
            
            // Try to parse as JSON
            try {
                const result = JSON.parse(responseText);
                
                if (result.error) {
                    throw new Error(result.error);
                }
                
                return result;
            } catch (jsonError) {
                // Not JSON, return as-is
                return responseText;
            }
        } catch (error) {
            console.error("PBLite request error:", error);
            throw error;
        }
    }

    _get(action, params = {}) {
        return this._request("GET", action, params);
    }

    _post(action, data = {}) {
        return this._request("POST", action, data);
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
    async reg(username, password) {
        return await this._post("register", { username, password });
    }

    async login(username, password) {
        const result = await this._post("login", { username, password });
        if (result.success && result.token) {
            this.setToken(result.token);
        }
        return result;
    }

    logout() {
        this.clearToken();
        return { success: true };
    }

    async passChange(newPassword) {
        return await this._post("change_password", { new_password: newPassword });
    }

    /* ===== COLLECTIONS ===== */
    async colAdd(name, pub = 0) {
        return await this._post("create_collection", { name, public: pub });
    }

    async colUpdate(name, newName, pub = null) {
        const data = { name, new_name: newName };
        if (pub !== null) data.public = pub;
        return await this._post("update_collection", data);
    }

    async colDelete(name) {
        return await this._post("delete_collection", { name });
    }

    async colList() {
        return await this._get("list_collections");
    }

    /* ===== RECORDS ===== */
    async recAdd(collectionName, data) {
        return await this._post("add_record", {
            collection_name: collectionName,
            data: JSON.stringify(data)
        });
    }

    async recUpdate(collectionName, id, data) {
        return await this._post("update_record", {
            collection_name: collectionName,
            record_id: id,
            data: JSON.stringify(data)
        });
    }

    async recDelete(collectionName, id) {
        return await this._post("delete_record", {
            collection_name: collectionName,
            record_id: id
        });
    }

    async recList(collectionName, search = "") {
        return await this._get("list_records", { 
            collection_name: collectionName, 
            search 
        });
    }

    async recGet(id) {
        return await this._get("get_record", { record_id: id });
    }

    /* ===== FILES ===== */
    async fileUpload(file, collectionName = null) {
        const formData = new FormData();
        formData.append("action", "upload_file");
        formData.append("file", file);
        if (collectionName) {
            formData.append("collection_name", collectionName);
        }
        
        return await this._request("POST", "upload_file", formData, true);
    }

    async fileDownload(fileId) {
        return await this._request("GET", "download_file", { file_id: fileId });
    }

    async fileDelete(fileId) {
        return await this._post("delete_file", { file_id: fileId });
    }

    async fileList() {
        return await this._get("file_list");
    }

    /* ===== ADMIN ===== */
    async admUsers() {
        return await this._get("admin_list_users");
    }

    async admDisable(userId) {
        return await this._post("admin_disable_user", { user_id: userId });
    }
    
    async admEnable(userId) {
        return await this._post("admin_enable_user", { user_id: userId });
    }

    async admPromote(userId) {
        return await this._post("admin_promote_user", { user_id: userId });
    }

    async admCredit(userId, credits) {
        return await this._post("admin_add_credit", { user_id: userId, credits });
    }

    async admWipe(collectionId) {
        return await this._post("admin_wipe_collection", { collection_id: collectionId });
    }

    async admSetLimits(userId, perMinute, perDay, perMonth) {
        return await this._post("admin_set_user_limits", {
            user_id: userId,
            per_minute: perMinute,
            per_day: perDay,
            per_month: perMonth
        });
    }

    /* ===== UTILITY ===== */
    async ping() {
        return await this._get("ping");
    }

    getToken() {
        return this.token;
    }

    isAuthenticated() {
        return !!this.token && this.token !== 'null' && this.token !== 'undefined';
    }

    enableDebug() {
        this.debug = true;
    }
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PBLite;
}

// Global for browser
if (typeof window !== 'undefined') {
    window.PBLite = PBLite;
}
