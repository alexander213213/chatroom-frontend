const MAX_CONTENT = 4000; // backend limit for messages and notes
const PAGE_SIZE = 30;
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😭', '🎉', '🔥', '💀', '💯', '✨', '🚀'];
const FILE_PREFIX = '📎 ';

let currentUsername = session.username;
let currentRoom = null;
let rooms = [];
let roomMembers = [];
let messages = [];        // current room, oldest first
let hasMoreMessages = false;
let loadingOlder = false;

let stompClient = null;
let roomSubscriptions = [];
let reconnectDelay = 2000;
let hasConnectedOnce = false;

let replyToId = null;
let editingId = null;
let pendingFiles = [];
let emojiTarget = null;

const typingUsers = new Map(); // username -> clear timer
let typingSentAt = 0;
let typingStopTimer = null;

const $ = id => document.getElementById(id);

const ICONS = {
    reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>',
    react: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!session.token || !currentUsername || !session.isValid()) {
        session.expire();
        return;
    }

    $('currentUsername').textContent = currentUsername;
    renderMyAvatar();
    setupEventListeners();
    setupEmojiPicker();

    await loadRooms();
    connectWebSocket();

    // Keep relative timestamps fresh
    setInterval(() => {
        document.querySelectorAll('time[data-ts]').forEach(t => { t.textContent = formatTime(t.dataset.ts); });
    }, 60000);
});

/* ---------- Setup ---------- */

function setupEventListeners() {
    $('createRoomBtn').addEventListener('click', () => ui.openModal('createRoomModal'));
    $('createRoomForm').addEventListener('submit', e => { e.preventDefault(); createRoom(); });
    $('roomSearch').addEventListener('input', renderRooms);
    $('logoutBtn').addEventListener('click', logout);
    $('profileBtn').addEventListener('click', openProfile);
    $('avatarInput').addEventListener('change', e => { uploadAvatar(e.target.files[0]); e.target.value = ''; });
    $('removeAvatarBtn').addEventListener('click', removeAvatar);

    $('roomMembersBtn').addEventListener('click', showRoomMembers);
    $('deleteRoomBtn').addEventListener('click', deleteCurrentRoom);
    $('inviteForm').addEventListener('submit', e => { e.preventDefault(); inviteUsers(); });

    $('sidebarToggle').addEventListener('click', () => setOverlay('sidebar-open'));
    $('panelToggle').addEventListener('click', togglePanel);
    $('panelClose').addEventListener('click', () => setOverlay(null));
    $('scrim').addEventListener('click', () => setOverlay(null));

    // Composer
    const input = $('messageInput');
    $('sendBtn').addEventListener('click', sendMessage);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            sendMessage();
        } else if (e.key === 'Escape') {
            cancelComposerContext();
        } else if (e.key === 'ArrowUp' && !input.value) {
            const last = [...messages].reverse().find(m => m.username === currentUsername);
            if (last) { e.preventDefault(); startEdit(last.id); }
        }
    });
    input.addEventListener('input', () => {
        autoGrow(input);
        updateCharCount();
        handleTyping();
    });
    $('cancelReply').addEventListener('click', cancelComposerContext);
    $('chatFileUploadInput').addEventListener('change', e => { addPendingFiles(e.target.files); e.target.value = ''; });
    $('messageFilePreview').addEventListener('click', e => {
        const btn = e.target.closest('[data-remove]');
        if (btn) { pendingFiles.splice(Number(btn.dataset.remove), 1); renderPendingFiles(); }
    });

    // Drag & drop anywhere on the conversation
    const chat = $('chat');
    let dragDepth = 0;
    chat.addEventListener('dragenter', e => {
        if (!currentRoom || !e.dataTransfer.types.includes('Files')) return;
        dragDepth++;
        $('dropOverlay').hidden = false;
    });
    chat.addEventListener('dragover', e => { if (currentRoom) e.preventDefault(); });
    chat.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('dropOverlay').hidden = true; } });
    chat.addEventListener('drop', e => {
        e.preventDefault();
        dragDepth = 0;
        $('dropOverlay').hidden = true;
        if (currentRoom) addPendingFiles(e.dataTransfer.files);
    });

    // Message actions via delegation, so no user data ends up in inline handlers
    const container = $('messagesContainer');
    container.addEventListener('click', onMessageClick);
    container.addEventListener('scroll', () => {
        if (container.scrollTop < 80) loadOlderMessages();
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('#emojiPicker') && !e.target.closest('[data-action="pick-emoji"]')) hideEmojiPicker();
    });
    window.addEventListener('resize', hideEmojiPicker);
}

function setOverlay(name) {
    const app = $('app');
    app.classList.remove('sidebar-open', 'panel-open');
    if (name) app.classList.add(name);
    $('scrim').hidden = !name;
}

function togglePanel() {
    const app = $('app');
    if (window.matchMedia('(max-width: 1100px)').matches) {
        setOverlay(app.classList.contains('panel-open') ? null : 'panel-open');
    } else {
        app.classList.toggle('panel-collapsed');
    }
}

/* ---------- Session & profile ---------- */

async function logout() {
    try { await api.logout(); } catch { /* clearing locally is enough */ }
    if (stompClient?.connected) stompClient.disconnect();
    session.expire();
}

function renderMyAvatar() {
    $('myAvatar').innerHTML = ui.avatarHtml(currentUsername);
}

function openProfile() {
    $('profileName').textContent = currentUsername;
    $('profileAvatar').innerHTML = ui.avatarHtml(currentUsername, 'xl');
    ui.openModal('profileModal');
}

async function uploadAvatar(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return ui.toast('Choose an image file', 'error');
    if (file.size > 10 * 1024 * 1024) return ui.toast('Avatar must be under 10 MB', 'error');
    try {
        await api.uploadAvatar(file);
        refreshAvatar(currentUsername);
        ui.toast('Avatar updated', 'success');
    } catch (err) {
        ui.error(err);
    }
}

async function removeAvatar() {
    try {
        await api.deleteAvatar();
        refreshAvatar(currentUsername);
        ui.toast('Avatar removed', 'success');
    } catch (err) {
        ui.error(err);
    }
}

function refreshAvatar(username) {
    ui.avatarVersions[username] = Date.now();
    ui.noAvatar.delete(username);
    document.querySelectorAll(`[data-avatar="${CSS.escape(username)}"]`).forEach(el => {
        el.outerHTML = ui.avatarHtml(username, [...el.classList].filter(c => c !== 'avatar').join(' '));
    });
}

/* ---------- Rooms ---------- */

async function loadRooms() {
    try {
        rooms = await api.getRooms();
        renderRooms();
    } catch (err) {
        ui.error(err);
    }
}

function renderRooms() {
    const list = $('roomsList');
    const query = $('roomSearch').value.trim().toLowerCase();
    const shown = rooms.filter(r => r.name.toLowerCase().includes(query));

    if (rooms.length === 0) {
        list.innerHTML = '<p class="sidebar-empty">No rooms yet.<br>Create one with the + button.</p>';
        return;
    }
    if (shown.length === 0) {
        list.innerHTML = '<p class="sidebar-empty">No rooms match.</p>';
        return;
    }

    list.innerHTML = shown.map(room => {
        const owned = room.user?.username === currentUsername;
        return `<button class="room-item ${currentRoom?.id === room.id ? 'active' : ''}" data-room="${room.id}">
            <span class="room-badge">${ui.esc(room.name.charAt(0))}</span>
            <span class="room-name">${ui.esc(room.name)}</span>
            ${owned ? '<span class="room-owner" title="You own this room">★</span>' : ''}
        </button>`;
    }).join('');

    list.querySelectorAll('[data-room]').forEach(btn => {
        btn.addEventListener('click', () => {
            const room = rooms.find(r => r.id === Number(btn.dataset.room));
            if (room) selectRoom(room);
        });
    });
}

async function createRoom() {
    const name = $('roomName').value.trim();
    if (!name) return ui.toast('Give the room a name', 'error');
    if (name.length > 100) return ui.toast('Room names are at most 100 characters', 'error');

    const button = $('confirmCreateRoom');
    button.disabled = true;
    try {
        await api.createRoom(name);
        ui.closeModal('createRoomModal');
        $('roomName').value = '';
        const known = new Set(rooms.map(r => r.id));
        await loadRooms();
        // The API only answers with text, so find the new room by id
        const created = rooms.find(r => !known.has(r.id));
        if (created) selectRoom(created);
        ui.toast(`Created "${name}"`, 'success');
    } catch (err) {
        ui.error(err);
    } finally {
        button.disabled = false;
    }
}

async function selectRoom(room) {
    if (currentRoom?.id === room.id) return setOverlay(null);

    currentRoom = room;
    messages = [];
    hasMoreMessages = false;
    roomMembers = [];
    typingUsers.forEach(clearTimeout);
    typingUsers.clear();
    renderTyping();
    cancelComposerContext();
    pendingFiles = [];
    renderPendingFiles();

    $('currentRoomName').textContent = room.name;
    $('currentRoomMeta').textContent = '';
    $('roomActions').hidden = false;
    $('deleteRoomBtn').hidden = room.user?.username !== currentUsername;
    $('messageInputContainer').hidden = false;
    $('messagesContainer').innerHTML = '<div class="loading">Loading messages...</div>';
    renderRooms();
    setOverlay(null);

    subscribeToRoom(room.id);
    panel.loadRoom(room.id);

    await Promise.all([loadMessages(room.id), loadMembers(room.id)]);
    $('messageInput').focus();
}

function clearRoom() {
    unsubscribeRoom();
    currentRoom = null;
    messages = [];
    $('currentRoomName').textContent = 'No room selected';
    $('currentRoomMeta').textContent = '';
    $('roomActions').hidden = true;
    $('messageInputContainer').hidden = true;
    $('messagesContainer').innerHTML = `<div class="empty-state">
        <div class="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
        <h2>Pick a room</h2><p>Choose a room on the left, or create a new one to get started.</p></div>`;
    panel.loadRoom(null);
    renderRooms();
}

async function loadMembers(roomId) {
    try {
        const members = await api.getRoomMembers(roomId);
        if (currentRoom?.id !== roomId) return;
        roomMembers = members;
        const owner = currentRoom.user?.username;
        $('currentRoomMeta').textContent =
            `${members.length} member${members.length === 1 ? '' : 's'}${owner ? ` · owner ${owner}` : ''}`;
    } catch {
        /* header meta is optional */
    }
}

async function showRoomMembers() {
    if (!currentRoom) return;
    await loadMembers(currentRoom.id);
    renderMembers();
    ui.openModal('inviteMembersModal');
}

function renderMembers() {
    const owner = currentRoom?.user?.username;
    $('membersTitle').textContent = `Members of ${currentRoom.name}`;
    $('membersList').innerHTML = roomMembers.map(name => `
        <li class="member-item">
            ${ui.avatarHtml(name, 'sm')}
            <span class="member-name">${ui.esc(name)}</span>
            ${name === owner ? '<span class="tag">owner</span>' : ''}
            ${name === currentUsername ? '<span class="tag muted">you</span>' : ''}
        </li>`).join('');
}

async function inviteUsers() {
    const input = $('inviteUsername');
    const names = [...new Set(input.value.split(',').map(s => s.trim()).filter(Boolean))];
    if (!names.length || !currentRoom) return;

    const fresh = names.filter(n => !roomMembers.some(m => m.toLowerCase() === n.toLowerCase()));
    if (!fresh.length) return ui.toast('Already in the room', 'info');

    const button = $('confirmInvite');
    button.disabled = true;
    try {
        await api.inviteUsers(currentRoom.id, fresh);
        await loadMembers(currentRoom.id);
        renderMembers();
        // The API ignores unknown usernames silently, so compare against the new member list
        const missing = fresh.filter(n => !roomMembers.some(m => m.toLowerCase() === n.toLowerCase()));
        const added = fresh.length - missing.length;
        if (added) ui.toast(`Added ${added} member${added === 1 ? '' : 's'}`, 'success');
        if (missing.length) ui.toast(`No such user: ${missing.join(', ')}`, 'error');
        input.value = '';
    } catch (err) {
        ui.error(err);
    } finally {
        button.disabled = false;
    }
}

async function deleteCurrentRoom() {
    if (!currentRoom) return;
    const ok = await ui.confirm(`Delete "${currentRoom.name}" with all its messages and notes? This cannot be undone.`,
        { title: 'Delete room', okText: 'Delete room' });
    if (!ok) return;

    try {
        await api.deleteRoom(currentRoom.id);
        const name = currentRoom.name;
        rooms = rooms.filter(r => r.id !== currentRoom.id);
        clearRoom();
        ui.toast(`Deleted "${name}"`, 'success');
    } catch (err) {
        ui.error(err);
    }
}

/* ---------- Messages ---------- */

// REST sends replyTo as a full message entity, WebSocket sends just its id
function normalizeMessage(raw) {
    const reply = raw.replyTo;
    return {
        id: raw.id,
        username: raw.username,
        content: raw.content ?? '',
        timestamp: ui.utc(raw.timestamp),
        replyToId: reply && typeof reply === 'object' ? reply.id : reply ?? null,
        replyToContent: reply && typeof reply === 'object' ? reply.content : null,
        reactions: (raw.reactions || []).map(r => ({ username: r.username, emoji: r.emoji }))
    };
}

async function loadMessages(roomId) {
    try {
        const page = await api.getMessages(roomId, null, PAGE_SIZE);
        if (currentRoom?.id !== roomId) return;
        messages = page.map(normalizeMessage);
        hasMoreMessages = page.length === PAGE_SIZE;
        renderMessages({ stickToBottom: true });
    } catch (err) {
        if (currentRoom?.id === roomId) {
            $('messagesContainer').innerHTML = `<div class="empty-state"><h2>Couldn't load messages</h2><p>${ui.esc(err.message)}</p></div>`;
        }
    }
}

async function loadOlderMessages() {
    if (!currentRoom || !hasMoreMessages || loadingOlder || !messages.length) return;
    loadingOlder = true;
    const roomId = currentRoom.id;
    const container = $('messagesContainer');
    try {
        const page = await api.getMessages(roomId, messages[0].id, PAGE_SIZE);
        if (currentRoom?.id !== roomId) return;
        hasMoreMessages = page.length === PAGE_SIZE;
        const known = new Set(messages.map(m => m.id));
        messages = [...page.map(normalizeMessage).filter(m => !known.has(m.id)), ...messages];
        const fromBottom = container.scrollHeight - container.scrollTop;
        renderMessages();
        container.scrollTop = container.scrollHeight - fromBottom;
    } catch (err) {
        ui.error(err);
    } finally {
        loadingOlder = false;
    }
}

function renderMessages({ stickToBottom = false } = {}) {
    const container = $('messagesContainer');
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;

    if (!messages.length) {
        container.innerHTML = `<div class="empty-state">
            <div class="empty-icon" aria-hidden="true">${ICONS.react}</div>
            <h2>Say hello</h2><p>No messages in ${ui.esc(currentRoom?.name)} yet. Start the conversation!</p></div>`;
        return;
    }

    let html = hasMoreMessages
        ? '<div class="history-marker">Scroll up for older messages</div>'
        : '<div class="history-marker">This is the beginning of the room</div>';
    let prev = null;

    for (const msg of messages) {
        const day = dayLabel(msg.timestamp);
        if (day && day !== dayLabel(prev?.timestamp)) {
            html += `<div class="day-divider"><span>${day}</span></div>`;
            prev = null;
        }
        const grouped = prev && prev.username === msg.username && !msg.replyToId && withinMinutes(prev, msg, 5);
        html += messageHtml(msg, grouped);
        prev = msg;
    }

    container.innerHTML = html;
    if (stickToBottom || nearBottom) container.scrollTop = container.scrollHeight;
}

function messageHtml(msg, grouped) {
    const own = msg.username === currentUsername;
    const name = ui.esc(msg.username);
    const time = msg.timestamp ? `<time data-ts="${ui.esc(msg.timestamp)}" title="${ui.esc(new Date(msg.timestamp).toLocaleString())}">${formatTime(msg.timestamp)}</time>` : '';

    let quote = '';
    if (msg.replyToId) {
        const original = messages.find(m => m.id === msg.replyToId);
        const text = original?.content ?? msg.replyToContent;
        quote = `<button class="msg-quote" data-action="jump" data-target="${msg.replyToId}">
            <span class="quote-author">${original ? ui.esc(original.username) : 'Reply'}</span>
            <span class="quote-text">${text == null ? '<em>Original message unavailable</em>' : ui.esc(text)}</span>
        </button>`;
    }

    return `<article class="msg ${own ? 'own' : ''} ${grouped ? 'grouped' : ''} ${editingId === msg.id ? 'editing' : ''}" data-id="${msg.id}">
        <div class="msg-gutter">${grouped ? '' : ui.avatarHtml(msg.username)}</div>
        <div class="msg-main">
            ${grouped ? '' : `<div class="msg-head"><span class="msg-author">${name}</span>${time}</div>`}
            ${quote}
            <div class="msg-body">${renderContent(msg.content)}</div>
            ${reactionsHtml(msg)}
        </div>
        <div class="msg-toolbar" role="toolbar">
            <button class="icon-btn" data-action="reply" title="Reply" aria-label="Reply">${ICONS.reply}</button>
            <button class="icon-btn" data-action="pick-emoji" title="React" aria-label="React">${ICONS.react}</button>
            ${own ? `<button class="icon-btn" data-action="edit" title="Edit" aria-label="Edit">${ICONS.edit}</button>
            <button class="icon-btn danger" data-action="delete" title="Delete" aria-label="Delete">${ICONS.trash}</button>` : ''}
        </div>
    </article>`;
}

function reactionsHtml(msg) {
    if (!msg.reactions.length) return '';
    const groups = new Map();
    msg.reactions.forEach(r => groups.set(r.emoji, [...(groups.get(r.emoji) || []), r.username]));
    return `<div class="reactions">${[...groups].map(([emoji, users]) => `
        <button class="reaction ${users.includes(currentUsername) ? 'mine' : ''}" data-action="react" data-emoji="${ui.esc(emoji)}" title="${ui.esc(users.join(', '))}">
            <span>${ui.esc(emoji)}</span><span class="reaction-count">${users.length}</span>
        </button>`).join('')}</div>`;
}

// Escape first, then turn bare URLs and shared-file markers into links
function renderContent(content) {
    if (content.startsWith(FILE_PREFIX)) {
        const filename = content.slice(FILE_PREFIX.length);
        return `<button class="file-chip" data-action="open-file" data-file="${ui.esc(filename)}">📎 <span>${ui.esc(filename)}</span></button>`;
    }
    return ui.esc(content).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)'"]/g,
        url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

function onMessageClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const article = btn.closest('.msg');
    const id = article ? Number(article.dataset.id) : null;

    switch (btn.dataset.action) {
        case 'reply': startReply(id); break;
        case 'edit': startEdit(id); break;
        case 'delete': deleteMessage(id); break;
        case 'pick-emoji': showEmojiPicker(btn, id); break;
        case 'react': toggleReaction(id, btn.dataset.emoji); break;
        case 'jump': jumpToMessage(Number(btn.dataset.target)); break;
        case 'open-file': panel.openFile(btn.dataset.file); break;
    }
}

function jumpToMessage(id) {
    const el = document.querySelector(`.msg[data-id="${id}"]`);
    if (!el) return ui.toast('That message is further back in history');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1200);
}

function formatTime(ts) {
    const date = new Date(ts);
    if (isNaN(date)) return '';
    const diff = Date.now() - date;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(ts) {
    const date = ts ? new Date(ts) : null;
    if (!date || isNaN(date)) return '';
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function withinMinutes(a, b, minutes) {
    if (!a.timestamp || !b.timestamp) return true;
    return Math.abs(new Date(b.timestamp) - new Date(a.timestamp)) < minutes * 60000;
}

/* ---------- Composer ---------- */

function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
}

function updateCharCount() {
    const len = $('messageInput').value.length;
    const el = $('charCount');
    el.textContent = len > MAX_CONTENT - 500 ? `${len}/${MAX_CONTENT}` : '';
    el.classList.toggle('over', len >= MAX_CONTENT);
}

function sendStomp(destination, body) {
    if (!stompClient?.connected) {
        ui.toast('Not connected. Reconnecting...', 'error');
        return false;
    }
    stompClient.send(destination, {}, JSON.stringify(body));
    return true;
}

async function sendMessage() {
    if (!currentRoom) return;
    const input = $('messageInput');
    const content = input.value.trim();
    if (!content && !pendingFiles.length) return;
    if (content.length > MAX_CONTENT) return ui.toast(`Messages are at most ${MAX_CONTENT} characters`, 'error');

    const dest = `/app/rooms/${currentRoom.id}/message`;
    if (editingId) {
        if (!content) return;
        const original = messages.find(m => m.id === editingId);
        if (original?.content !== content && !sendStomp(dest, { id: editingId, content, type: 'UPDATE' })) return;
    } else if (content) {
        if (!sendStomp(dest, { content, type: 'POST', replyTo: replyToId })) return;
    }

    input.value = '';
    autoGrow(input);
    updateCharCount();
    cancelComposerContext();
    stopTyping();

    if (pendingFiles.length) await uploadPendingFiles();
}

function startReply(id) {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    editingId = null;
    replyToId = id;
    showComposerContext(`Replying to <strong>${ui.esc(msg.username)}</strong>: ${ui.esc(msg.content.slice(0, 120))}`);
    $('messageInput').focus();
}

function startEdit(id) {
    const msg = messages.find(m => m.id === id);
    if (!msg || msg.username !== currentUsername) return;
    replyToId = null;
    editingId = id;
    showComposerContext('<strong>Editing message</strong> · Esc to cancel');
    const input = $('messageInput');
    input.value = msg.content;
    autoGrow(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    renderMessages();
}

function showComposerContext(html) {
    $('replyText').innerHTML = html;
    $('replyPreview').hidden = false;
}

function cancelComposerContext() {
    const wasEditing = editingId !== null;
    replyToId = null;
    editingId = null;
    $('replyPreview').hidden = true;
    if (wasEditing) {
        $('messageInput').value = '';
        autoGrow($('messageInput'));
        renderMessages();
    }
}

async function deleteMessage(id) {
    const ok = await ui.confirm('Delete this message for everyone?', { title: 'Delete message', okText: 'Delete' });
    if (ok && currentRoom) sendStomp(`/app/rooms/${currentRoom.id}/message`, { id, type: 'DELETE' });
}

/* ---------- Attachments ---------- */

const MAX_UPLOAD = 200 * 1024 * 1024;

function addPendingFiles(fileList) {
    for (const file of fileList) {
        if (file.size > MAX_UPLOAD) ui.toast(`${file.name} is over the 200 MB limit`, 'error');
        else if (file.size === 0) ui.toast(`${file.name} is empty`, 'error');
        else pendingFiles.push(file);
    }
    renderPendingFiles();
    $('messageInput').focus();
}

function renderPendingFiles() {
    const box = $('messageFilePreview');
    box.hidden = !pendingFiles.length;
    box.innerHTML = pendingFiles.map((f, i) => `
        <span class="pending-file" title="${ui.esc(f.name)}">
            📎 <span class="pending-name">${ui.esc(f.name)}</span>
            <span class="pending-size">${ui.formatSize(f.size)}</span>
            <button data-remove="${i}" aria-label="Remove ${ui.esc(f.name)}">✕</button>
        </span>`).join('');
}

// Uploads each file, then announces it in chat so other members see it
async function uploadPendingFiles() {
    const roomId = currentRoom.id;
    const files = pendingFiles;
    pendingFiles = [];
    renderPendingFiles();

    const sendBtn = $('sendBtn');
    sendBtn.disabled = true;
    sendBtn.classList.add('busy');
    let uploaded = 0;
    try {
        for (const file of files) {
            try {
                const result = await api.uploadFile(roomId, file);
                uploaded++;
                if (currentRoom?.id === roomId) {
                    sendStomp(`/app/rooms/${roomId}/message`, { content: FILE_PREFIX + result.filename, type: 'POST' });
                }
            } catch (err) {
                ui.toast(`${file.name}: ${err.message}`, 'error');
            }
        }
    } finally {
        sendBtn.disabled = false;
        sendBtn.classList.remove('busy');
    }
    if (uploaded) {
        ui.toast(`Uploaded ${uploaded} file${uploaded === 1 ? '' : 's'}`, 'success');
        if (currentRoom?.id === roomId) panel.loadFiles(roomId);
    }
}

/* ---------- Reactions ---------- */

function setupEmojiPicker() {
    const picker = $('emojiPicker');
    picker.innerHTML = EMOJIS.map(e => `<button class="emoji-item" role="menuitem" data-emoji="${e}">${e}</button>`).join('');
    picker.addEventListener('click', e => {
        const btn = e.target.closest('[data-emoji]');
        if (!btn || emojiTarget == null) return;
        toggleReaction(emojiTarget, btn.dataset.emoji);
        hideEmojiPicker();
    });
}

function showEmojiPicker(anchor, messageId) {
    const picker = $('emojiPicker');
    emojiTarget = messageId;
    picker.hidden = false;
    const a = anchor.getBoundingClientRect();
    const p = picker.getBoundingClientRect();
    const left = Math.max(8, Math.min(a.right - p.width, window.innerWidth - p.width - 8));
    const top = a.top - p.height - 8 > 8 ? a.top - p.height - 8 : a.bottom + 8;
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
}

function hideEmojiPicker() {
    $('emojiPicker').hidden = true;
    emojiTarget = null;
}

// One reaction per user per message: same emoji removes it, another emoji swaps it
function toggleReaction(messageId, emoji) {
    if (!currentRoom) return;
    const msg = messages.find(m => m.id === messageId);
    const mine = msg?.reactions.find(r => r.username === currentUsername);
    const type = !mine ? 'POST' : mine.emoji === emoji ? 'DELETE' : 'UPDATE';
    sendStomp(`/app/rooms/${currentRoom.id}/react`, { messageId, emoji, type });
}

/* ---------- Typing ---------- */

function handleTyping() {
    if (!currentRoom) return;
    if (Date.now() - typingSentAt > 2500) {
        typingSentAt = Date.now();
        sendTyping(true);
    }
    clearTimeout(typingStopTimer);
    typingStopTimer = setTimeout(stopTyping, 3000);
}

function stopTyping() {
    clearTimeout(typingStopTimer);
    if (typingSentAt) {
        typingSentAt = 0;
        sendTyping(false);
    }
}

function sendTyping(typing) {
    if (currentRoom && stompClient?.connected) {
        stompClient.send(`/app/rooms/${currentRoom.id}/typing`, {}, JSON.stringify({ typing }));
    }
}

function handleTypingEvent(data) {
    if (data.username === currentUsername) return;
    clearTimeout(typingUsers.get(data.username));
    if (data.typing) {
        // Clears itself in case the "stopped" event never arrives
        typingUsers.set(data.username, setTimeout(() => { typingUsers.delete(data.username); renderTyping(); }, 6000));
    } else {
        typingUsers.delete(data.username);
    }
    renderTyping();
}

function renderTyping() {
    const names = [...typingUsers.keys()];
    const el = $('typingIndicator');
    el.classList.toggle('show', names.length > 0);
    el.innerHTML = !names.length ? '' :
        `<span class="dots"><i></i><i></i><i></i></span> ${
            names.length === 1 ? `<strong>${ui.esc(names[0])}</strong> is typing` :
            names.length === 2 ? `<strong>${ui.esc(names[0])}</strong> and <strong>${ui.esc(names[1])}</strong> are typing` :
            'Several people are typing'}`;
}

/* ---------- WebSocket ---------- */

function setConnState(state, text) {
    const el = $('connStatus');
    el.dataset.state = state;
    el.textContent = text;
}

function connectWebSocket() {
    if (!session.isValid()) return session.expire();

    setConnState('connecting', hasConnectedOnce ? 'Reconnecting...' : 'Connecting...');
    const client = Stomp.over(new SockJS(CONFIG.WS_BASE));
    client.debug = null;
    stompClient = client;

    client.connect(
        { Authorization: `Bearer ${session.token}` },
        async () => {
            reconnectDelay = 2000;
            setConnState('online', 'Online');
            const reconnect = hasConnectedOnce;
            hasConnectedOnce = true;
            if (reconnect) {
                // A refused SUBSCRIBE drops the socket, so make sure we are still in the room
                await loadRooms();
                if (currentRoom && !rooms.some(r => r.id === currentRoom.id)) {
                    ui.toast(`You no longer have access to "${currentRoom.name}"`, 'error');
                    clearRoom();
                }
            }
            if (currentRoom) {
                subscribeToRoom(currentRoom.id);
                if (reconnect) {
                    loadMessages(currentRoom.id);
                    panel.loadRoom(currentRoom.id);
                }
            }
        },
        () => {
            if (stompClient !== client) return;
            roomSubscriptions = [];
            setConnState('offline', 'Offline · retrying');
            setTimeout(connectWebSocket, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        }
    );
}

function unsubscribeRoom() {
    roomSubscriptions.forEach(sub => { try { sub.unsubscribe(); } catch { /* socket gone */ } });
    roomSubscriptions = [];
}

// Exactly one set of subscriptions, for the open room
function subscribeToRoom(roomId) {
    unsubscribeRoom();
    if (!stompClient?.connected) return;
    const on = (topic, handler) => roomSubscriptions.push(
        stompClient.subscribe(`/topic/${roomId}/${topic}`, frame => {
            if (currentRoom?.id === roomId) handler(JSON.parse(frame.body));
        })
    );
    on('messages', handleIncomingMessage);
    on('reactions', handleIncomingReaction);
    on('typing', handleTypingEvent);
    on('notes', note => panel.handleIncomingNote(note));
}

function handleIncomingMessage(event) {
    if (event.type === 'POST') {
        if (messages.some(m => m.id === event.id)) return;
        // Broadcasts carry no timestamp; the server just saved it, so "now" is right
        messages.push(normalizeMessage({ ...event, timestamp: new Date().toISOString() }));
        typingUsers.delete(event.username);
        renderTyping();
        const mine = event.username === currentUsername;
        renderMessages({ stickToBottom: mine });
        if (event.content.startsWith(FILE_PREFIX) && !mine) panel.loadFiles(currentRoom.id);
    } else if (event.type === 'UPDATE') {
        const msg = messages.find(m => m.id === event.id);
        if (msg) msg.content = event.content;
        renderMessages();
    } else if (event.type === 'DELETE') {
        messages = messages.filter(m => m.id !== event.id);
        if (editingId === event.id || replyToId === event.id) cancelComposerContext();
        renderMessages();
    }
}

function handleIncomingReaction(event) {
    const msg = messages.find(m => m.id === event.messageId);
    if (!msg) return;
    msg.reactions = msg.reactions.filter(r => r.username !== event.username);
    if (event.type === 'POST' || event.type === 'UPDATE') {
        msg.reactions.push({ username: event.username, emoji: event.emoji });
    }
    renderMessages();
}
