const api = {
    async request(endpoint, options = {}) {
        const url = `${CONFIG.API_BASE}${endpoint}`;
        const token = localStorage.getItem('token');
        
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };
        
        const response = await fetch(url, { ...defaultOptions, ...options });
        
        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            window.location.href = 'login.html';
            return;
        }
        
        return response;
    },
    
    async register(username, password) {
        return await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },
    
    async login(username, password) {
        return await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },
    
    async logout() {
        return await this.request('/auth/logout', {
            method: 'POST'
        });
    },
    
    async getRooms() {
        return await this.request('/rooms');
    },
    
    async createRoom(name) {
        return await this.request('/rooms', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
    },
    
    async getRoomMembers(roomId) {
        return await this.request(`/rooms/${roomId}`);
    },
    
    async inviteUsers(roomId, usernames) {
        return await this.request(`/rooms/${roomId}/invite`, {
            method: 'POST',
            body: JSON.stringify(usernames)
        });
    },
    
    async deleteRoom(roomId) {
        return await this.request(`/rooms/${roomId}`, {
            method: 'DELETE'
        });
    },
    
    async getMessages(roomId, before = null, limit = 20) {
        const params = new URLSearchParams({ limit });
        if (before) params.append('before', before);
        return await this.request(`/rooms/${roomId}/messages?${params}`);
    },
    
    async getNotes(roomId, before = null, limit = 20) {
        const params = new URLSearchParams({ limit });
        if (before) params.append('before', before);
        return await this.request(`/rooms/${roomId}/notes?${params}`);
    }
};