// Notes & files panel. Uses currentRoom, currentUsername, sendStomp and $ from chat.js.
const FILE_ICONS = {
    pdf: '📄', doc: '📘', docx: '📘', txt: '📋', md: '📋', csv: '📊', xls: '📊', xlsx: '📊',
    ppt: '📽️', pptx: '📽️', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
    zip: '📦', rar: '📦', '7z': '📦', mp3: '🎵', wav: '🎵', mp4: '🎬', mov: '🎬', webm: '🎬'
};
const FILE_CATEGORIES = {
    Images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    Documents: ['pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'xls', 'xlsx', 'ppt', 'pptx'],
    Audio: ['mp3', 'wav'],
    Video: ['mp4', 'mov', 'webm'],
    Archives: ['zip', 'rar', '7z']
};

const panel = {
    roomId: null,
    notes: [],
    files: [],
    editingNoteId: null,
    expanded: new Set([]), // other members whose notes are expanded

    init() {
        $('notesTabBtn').addEventListener('click', () => this.switchTab('notes'));
        $('filesTabBtn').addEventListener('click', () => this.switchTab('files'));
        $('saveNoteBtn').addEventListener('click', () => this.saveNote());
        $('cancelNoteEdit').addEventListener('click', () => this.cancelNoteEdit());
        $('noteInput').addEventListener('keydown', e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.saveNote();
            if (e.key === 'Escape') this.cancelNoteEdit();
        });
        $('notesList').addEventListener('click', e => this.onNotesClick(e));

        $('fileSearchInput').addEventListener('input', () => this.renderFiles());
        $('fileSortSelect').addEventListener('change', () => this.renderFiles());
        $('refreshFilesBtn').addEventListener('click', () => this.roomId && this.loadFiles(this.roomId));
        $('panelUploadInput').addEventListener('change', e => {
            if (currentRoom) { addPendingFiles(e.target.files); uploadPendingFiles(); }
            e.target.value = '';
        });
        $('filesList').addEventListener('click', e => this.onFilesClick(e));
        this.render();
    },

    switchTab(tab) {
        const notes = tab === 'notes';
        $('notesTabBtn').classList.toggle('active', notes);
        $('filesTabBtn').classList.toggle('active', !notes);
        $('notesTabBtn').setAttribute('aria-selected', notes);
        $('filesTabBtn').setAttribute('aria-selected', !notes);
        $('noteContainer').hidden = !notes;
        $('filesContainer').hidden = notes;
        // Uploads by others aren't pushed over the socket, so refresh on open
        if (!notes && this.roomId) this.loadFiles(this.roomId);
    },

    loadRoom(roomId) {
        this.roomId = roomId;
        this.notes = [];
        this.files = [];
        this.expanded.clear();
        this.cancelNoteEdit();
        this.render();
        if (roomId) {
            this.loadNotes(roomId);
            this.loadFiles(roomId);
        }
    },

    render() {
        this.renderNotes();
        this.renderFiles();
        const disabled = !this.roomId;
        $('noteInput').disabled = disabled;
        $('saveNoteBtn').disabled = disabled;
        $('fileSearchInput').disabled = disabled;
    },

    /* ---------- Notes ---------- */

    async loadNotes(roomId) {
        try {
            const notes = await api.getNotes(roomId);
            if (this.roomId === roomId) { this.notes = notes; this.renderNotes(); }
        } catch (err) {
            if (this.roomId === roomId) ui.error(err);
        }
    },

    renderNotes() {
        const list = $('notesList');
        if (!this.roomId) {
            list.innerHTML = '<p class="panel-empty">Open a room to see its notes.</p>';
            return;
        }

        const mine = this.notes.filter(n => n.username === currentUsername);
        const byUser = new Map();
        this.notes.filter(n => n.username !== currentUsername)
            .forEach(n => byUser.set(n.username, [...(byUser.get(n.username) || []), n]));

        let html = `<h3 class="panel-section">Your notes <span class="badge">${mine.length}</span></h3>`;
        html += mine.length
            ? mine.map(n => this.noteHtml(n, true)).join('')
            : '<p class="panel-empty">Nothing yet. Notes you save here are visible to everyone in the room.</p>';

        if (byUser.size) {
            html += '<h3 class="panel-section">From the room</h3>';
            for (const [user, notes] of byUser) {
                const open = this.expanded.has(user);
                html += `<div class="note-group ${open ? 'open' : ''}">
                    <button class="note-group-head" data-action="toggle" data-user="${ui.esc(user)}" aria-expanded="${open}">
                        ${ui.avatarHtml(user, 'sm')}
                        <span class="note-group-name">${ui.esc(user)}</span>
                        <span class="badge">${notes.length}</span>
                        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div class="note-group-body">${notes.map(n => this.noteHtml(n, false)).join('')}</div>
                </div>`;
            }
        }
        list.innerHTML = html;
    },

    noteHtml(note, editable) {
        return `<div class="note ${this.editingNoteId === note.id ? 'editing' : ''}" data-note="${note.id}">
            <p class="note-text">${ui.esc(note.content)}</p>
            <div class="note-actions">
                <button class="icon-btn" data-action="view" title="Open" aria-label="Open note">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                ${editable ? `
                <button class="icon-btn" data-action="edit" title="Edit" aria-label="Edit note">${ICONS.edit}</button>
                <button class="icon-btn danger" data-action="delete" title="Delete" aria-label="Delete note">${ICONS.trash}</button>` : ''}
            </div>
        </div>`;
    },

    onNotesClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'toggle') {
            const user = btn.dataset.user;
            this.expanded.has(user) ? this.expanded.delete(user) : this.expanded.add(user);
            return this.renderNotes();
        }
        const note = this.notes.find(n => n.id === Number(btn.closest('[data-note]')?.dataset.note));
        if (!note) return;
        if (btn.dataset.action === 'view') this.viewNote(note);
        if (btn.dataset.action === 'edit') this.startNoteEdit(note);
        if (btn.dataset.action === 'delete') this.deleteNote(note);
    },

    viewNote(note) {
        $('viewerTitle').textContent = `Note by ${note.username}`;
        $('viewerDownload').hidden = true;
        $('viewerBody').innerHTML = `<p class="note-full">${ui.esc(note.content)}</p>`;
        ui.openModal('viewerModal');
    },

    saveNote() {
        if (!currentRoom) return;
        const input = $('noteInput');
        const content = input.value.trim();
        if (!content) return ui.toast('Write something first', 'error');
        if (content.length > MAX_CONTENT) return ui.toast(`Notes are at most ${MAX_CONTENT} characters`, 'error');

        const body = this.editingNoteId
            ? { id: this.editingNoteId, content, type: 'UPDATE' }
            : { content, type: 'POST' };
        if (sendStomp(`/app/rooms/${currentRoom.id}/note`, body)) {
            input.value = '';
            this.cancelNoteEdit();
        }
    },

    startNoteEdit(note) {
        this.editingNoteId = note.id;
        const input = $('noteInput');
        input.value = note.content;
        input.focus();
        $('saveNoteBtn').textContent = 'Update note';
        $('cancelNoteEdit').hidden = false;
        this.renderNotes();
    },

    cancelNoteEdit() {
        if (this.editingNoteId) $('noteInput').value = '';
        this.editingNoteId = null;
        $('saveNoteBtn').textContent = 'Save note';
        $('cancelNoteEdit').hidden = true;
        this.renderNotes();
    },

    async deleteNote(note) {
        const ok = await ui.confirm('Delete this note?', { title: 'Delete note', okText: 'Delete' });
        if (ok && currentRoom) sendStomp(`/app/rooms/${currentRoom.id}/note`, { id: note.id, type: 'DELETE' });
    },

    handleIncomingNote(event) {
        if (event.type === 'POST') {
            if (!this.notes.some(n => n.id === event.id)) this.notes.push(event);
        } else if (event.type === 'UPDATE') {
            const note = this.notes.find(n => n.id === event.id);
            if (note) note.content = event.content;
        } else if (event.type === 'DELETE') {
            this.notes = this.notes.filter(n => n.id !== event.id);
            if (this.editingNoteId === event.id) this.cancelNoteEdit();
        }
        this.renderNotes();
    },

    /* ---------- Files ---------- */

    async loadFiles(roomId) {
        try {
            const files = await api.listFiles(roomId);
            if (this.roomId !== roomId) return;
            this.files = files.map(f => {
                const ext = f.filename.includes('.') ? f.filename.split('.').pop().toLowerCase() : '';
                return {
                    name: f.filename,
                    ext,
                    size: f.size,
                    uploadedAt: f.uploaded_at,
                    url: f.download_url,
                    isImage: f.is_image ?? (f.content_type || '').startsWith('image/'),
                    category: Object.keys(FILE_CATEGORIES).find(c => FILE_CATEGORIES[c].includes(ext)) || 'Other'
                };
            });
            this.renderFiles();
        } catch (err) {
            if (this.roomId === roomId) ui.error(err);
        }
    },

    renderFiles() {
        $('fileCountBadge').textContent = this.files.length;
        const list = $('filesList');
        if (!this.roomId) {
            list.innerHTML = '<p class="panel-empty">Open a room to see its files.</p>';
            return;
        }

        const query = $('fileSearchInput').value.trim().toLowerCase();
        const sort = $('fileSortSelect').value;
        const files = this.files.filter(f => f.name.toLowerCase().includes(query));
        const sorters = {
            date: (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0),
            name: (a, b) => a.name.localeCompare(b.name),
            size: (a, b) => b.size - a.size,
            type: (a, b) => a.ext.localeCompare(b.ext) || a.name.localeCompare(b.name)
        };
        files.sort(sorters[sort]);

        if (!files.length) {
            list.innerHTML = this.files.length
                ? '<p class="panel-empty">No files match your search.</p>'
                : '<p class="panel-empty">No files yet. Drop files on the chat or use Upload.</p>';
            return;
        }

        const groups = new Map();
        files.forEach(f => groups.set(f.category, [...(groups.get(f.category) || []), f]));
        list.innerHTML = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => `
            <h3 class="panel-section">${category} <span class="badge">${items.length}</span></h3>
            ${items.map(f => `
                <div class="file-item" data-file="${ui.esc(f.name)}">
                    <button class="file-open" data-action="open" title="${f.isImage ? 'Preview' : 'Download'} ${ui.esc(f.name)}">
                        <span class="file-icon" aria-hidden="true">${FILE_ICONS[f.ext] || '📎'}</span>
                        <span class="file-info">
                            <span class="file-name">${ui.esc(f.name)}</span>
                            <span class="file-meta">${ui.formatSize(f.size)}${f.uploadedAt ? ` · ${ui.relativeTime(f.uploadedAt)}` : ''}</span>
                        </span>
                    </button>
                    <button class="icon-btn" data-action="download" title="Download" aria-label="Download">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                    <button class="icon-btn danger" data-action="delete" title="Delete" aria-label="Delete">${ICONS.trash}</button>
                </div>`).join('')}`).join('');
    },

    onFilesClick(e) {
        const btn = e.target.closest('[data-action]');
        const name = btn?.closest('[data-file]')?.dataset.file;
        const file = this.files.find(f => f.name === name);
        if (!file) return;
        if (btn.dataset.action === 'open') this.openFile(file.name);
        if (btn.dataset.action === 'download') this.download(file);
        if (btn.dataset.action === 'delete') this.deleteFile(file);
    },

    // Images open in the viewer, everything else downloads
    async openFile(name) {
        let file = this.files.find(f => f.name === name);
        if (!file && this.roomId) {
            await this.loadFiles(this.roomId);
            file = this.files.find(f => f.name === name);
        }
        if (!file) return ui.toast('That file was deleted', 'error');
        if (!file.isImage) return this.download(file);

        $('viewerTitle').textContent = file.name;
        $('viewerBody').innerHTML = '<div class="loading">Loading preview...</div>';
        const dl = $('viewerDownload');
        dl.hidden = false;
        dl.onclick = () => this.download(file);
        ui.openModal('viewerModal');
        try {
            const url = URL.createObjectURL(await api.fileBlob(file.url));
            $('viewerBody').innerHTML = `<img class="viewer-img" src="${url}" alt="${ui.esc(file.name)}">`;
            $('viewerBody').querySelector('img').onload = () => URL.revokeObjectURL(url);
        } catch (err) {
            $('viewerBody').innerHTML = `<p class="panel-empty">${ui.esc(err.message)}</p>`;
        }
    },

    async download(file) {
        try {
            const url = URL.createObjectURL(await api.fileBlob(file.url));
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (err) {
            ui.error(err);
        }
    },

    async deleteFile(file) {
        const ok = await ui.confirm(`Delete "${file.name}" for everyone in the room?`, { title: 'Delete file', okText: 'Delete' });
        if (!ok) return;
        try {
            await api.deleteFile(this.roomId, file.name);
            this.files = this.files.filter(f => f !== file);
            this.renderFiles();
            ui.toast(`Deleted ${file.name}`, 'success');
        } catch (err) {
            ui.error(err);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => panel.init());
