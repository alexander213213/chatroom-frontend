const session = {
    get token() { return localStorage.getItem('token'); },
    get username() { return localStorage.getItem('username'); },
    // The token's subject is the canonical username (login lookup may ignore case)
    save(token, typedUsername) {
        localStorage.setItem('token', token);
        localStorage.setItem('username', claims(token)?.sub || typedUsername);
    },
    // Checks the exp claim only; the signature is the server's job
    isValid() {
        const payload = claims(this.token);
        return !!payload && (!payload.exp || payload.exp * 1000 > Date.now());
    },
    clear() {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
    },
    expire() {
        this.clear();
        window.location.href = 'login.html';
    }
};

const api = {
    // Returns the Response; 401 on a protected endpoint ends the session
    async request(endpoint, options = {}) {
        const headers = { ...(options.headers || {}) };
        if (session.token) headers.Authorization = `Bearer ${session.token}`;
        if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

        const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
            credentials: 'include',
            ...options,
            headers
        });

        // Spring answers anonymous requests with 403; GET /rooms only does that when the token is bad
        const rejected = response.status === 401 || (response.status === 403 && endpoint === '/rooms');
        if (rejected && !endpoint.startsWith('/auth/')) {
            session.expire();
            throw new Error('Session expired');
        }
        return response;
    },

    // Throws with the server's message on a non-2xx response
    async json(endpoint, options) {
        const response = await this.request(endpoint, options);
        if (!response.ok) throw new Error(await errorText(response));
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    },

    async send(endpoint, method, body) {
        const response = await this.request(endpoint, {
            method,
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        if (!response.ok) throw new Error(await errorText(response));
        return response.text();
    },

    // Auth: these return the raw Response so the forms can read status codes
    register(username, password) {
        return this.request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    },
    login(username, password) {
        return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    },
    logout() {
        return this.request('/auth/logout', { method: 'POST' });
    },

    // Rooms
    getRooms() { return this.json('/rooms'); },
    createRoom(name) { return this.send('/rooms', 'POST', { name }); },
    getRoomMembers(roomId) { return this.json(`/rooms/${roomId}`); },
    inviteUsers(roomId, usernames) { return this.send(`/rooms/${roomId}/invite`, 'POST', usernames); },
    deleteRoom(roomId) { return this.send(`/rooms/${roomId}`, 'DELETE'); },

    getMessages(roomId, before = null, limit = 30) {
        const params = new URLSearchParams({ limit });
        if (before) params.append('before', before);
        return this.json(`/rooms/${roomId}/messages?${params}`);
    },
    getNotes(roomId, limit = 100) {
        return this.json(`/rooms/${roomId}/notes?limit=${limit}`);
    },

    // Files
    async listFiles(roomId) {
        const data = await this.json(`/api/files/rooms/${roomId}/attachments`);
        return data.attachments || [];
    },
    async uploadFile(roomId, file) {
        const body = new FormData();
        body.append('file', file);
        const response = await this.request(`/api/files/rooms/${roomId}/attachments`, { method: 'POST', body });
        if (!response.ok) throw new Error(await errorText(response));
        return response.json();
    },
    deleteFile(roomId, filename) {
        return this.send(`/api/files/rooms/${roomId}/attachments/${encodeURIComponent(filename)}`, 'DELETE');
    },
    // Downloads go through fetch so they carry the bearer token, not just the cookie
    async fileBlob(path) {
        const response = await this.request(path);
        if (!response.ok) throw new Error('File not found');
        return response.blob();
    },

    // Avatars
    async uploadAvatar(file) {
        const body = new FormData();
        body.append('file', file);
        const response = await this.request('/api/files/avatars', { method: 'POST', body });
        if (!response.ok) throw new Error(await errorText(response));
        return response.json();
    },
    deleteAvatar() { return this.send('/api/files/avatars', 'DELETE'); }
};

function claims(token) {
    try {
        return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
        return null;
    }
}

async function errorText(response) {
    const text = await response.text().catch(() => '');
    try {
        const data = JSON.parse(text);
        return data.error || data.message || `Request failed (${response.status})`;
    } catch {
        return text || `Request failed (${response.status})`;
    }
}
