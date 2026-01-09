let currentUsername = null;
let currentRoom = null;
let stompClient = null;
let rooms = [];
let messages = {};
let typingTimeout = null;
let replyToMessage = null;
let editingMessageId = null;
let emojiPickerTarget = null;
let timestampUpdateInterval = null;

const emojis = ['👍', '❤️', '😂', '😮', '😢', '😭', '🎉', '🔥', '👀', '💯', '✨', '🚀'];

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    // if (!token || !username) {
    //     window.location.href = 'login.html';
    //     return;
    // }
    
    currentUsername = username;
    document.getElementById('currentUsername').textContent = username;
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize
    await loadRooms();
    connectWebSocket();
    
    // Update timestamps every minute
    timestampUpdateInterval = setInterval(() => {
        if (currentRoom && messages[currentRoom.id] && messages[currentRoom.id].length > 0) {
            const container = document.getElementById('messagesContainer');
            // Update only timestamps without re-rendering everything
            const messageElements = container.querySelectorAll('.message');
            messageElements.forEach(msgEl => {
                const msgId = parseInt(msgEl.dataset.messageId);
                const msg = messages[currentRoom.id].find(m => m.id === msgId);
                if (msg && msg.timestamp) {
                    const timestampEl = msgEl.querySelector('.message-timestamp');
                    if (timestampEl) {
                        timestampEl.textContent = formatTime(msg.timestamp);
                    }
                }
            });
        }
    }, 60000);
});

function setupEventListeners() {
    // Create room
    document.getElementById('createRoomBtn').addEventListener('click', () => {
        openModal('createRoomModal');
    });
    
    document.getElementById('confirmCreateRoom').addEventListener('click', createRoom);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Room members
    document.getElementById('roomMembersBtn').addEventListener('click', showRoomMembers);
    
    // Delete room
    document.getElementById('deleteRoomBtn').addEventListener('click', deleteCurrentRoom);
    
    // Invite members
    document.getElementById('confirmInvite').addEventListener('click', inviteUser);
    
    // Send message
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Typing indicator
    document.getElementById('messageInput').addEventListener('input', handleTyping);
    
    // Cancel reply
    document.getElementById('cancelReply').addEventListener('click', cancelReply);
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal.id);
        });
    });
    
    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Setup emoji picker
    setupEmojiPicker();
    
    // Close emoji picker on outside click
    document.addEventListener('click', (e) => {
        const picker = document.getElementById('emojiPicker');
        if (!e.target.closest('.emoji-picker') && !e.target.closest('.message-actions')) {
            picker.style.display = 'none';
        }
    });
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
    
    // Clear inputs
    if (modalId === 'createRoomModal') {
        document.getElementById('roomName').value = '';
    }
    if (modalId === 'inviteMembersModal') {
        document.getElementById('inviteUsername').value = '';
    }
}

async function logout() {
    try {
        await api.logout();
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    if (stompClient) {
        stompClient.disconnect();
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = 'login.html';
}

async function loadRooms() {
    try {
        const response = await api.getRooms();
        if (response.ok) {
            rooms = await response.json();
            renderRooms();
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
    }
}

function renderRooms() {
    const roomsList = document.getElementById('roomsList');
    roomsList.innerHTML = '';
    
    if (rooms.length === 0) {
        roomsList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--medium-teal); font-size: 14px;">No rooms yet. Create one to start chatting!</div>';
        return;
    }
    
    rooms.forEach(room => {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'room-item';
        if (currentRoom && currentRoom.id === room.id) {
            roomDiv.classList.add('active');
        }
        roomDiv.textContent = room.name;
        roomDiv.onclick = () => selectRoom(room);
        roomsList.appendChild(roomDiv);
    });
}

async function createRoom() {
    const roomName = document.getElementById('roomName').value.trim();
    
    if (!roomName) {
        alert('Please enter a room name');
        return;
    }
    
    try {
        const response = await api.createRoom(roomName);
        if (response.ok) {
            closeModal('createRoomModal');
            await loadRooms();
        } else {
            alert('Failed to create room');
        }
    } catch (error) {
        console.error('Error creating room:', error);
        alert('Could not create room');
    }
}

async function selectRoom(room) {
    currentRoom = room;
    messages[room.id] = [];
    
    // Update UI
    document.getElementById('currentRoomName').textContent = room.name;
    document.getElementById('roomMembersBtn').style.display = 'block';
    document.getElementById('messageInputContainer').style.display = 'block';
    
    // Show delete button only if current user is the owner
    const deleteBtn = document.getElementById('deleteRoomBtn');
    if (room.user.username === currentUsername) {
        deleteBtn.style.display = 'block';
    } else {
        deleteBtn.style.display = 'none';
    }
    
    renderRooms();
    
    // Subscribe to room topics
    if (stompClient && stompClient.connected) {
        subscribeToRoom(room.id);
    }
    
    // Load messages
    await loadMessages(room.id);
}

async function loadMessages(roomId) {
    try {
        const response = await api.getMessages(roomId);
        if (response.ok) {
            const loadedMessages = await response.json();
            messages[roomId] = loadedMessages;
            renderMessages();
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function renderMessages() {
    const container = document.getElementById('messagesContainer');
    const noRoomDiv = container.querySelector('.no-room-selected');
    
    if (noRoomDiv) {
        noRoomDiv.remove();
    }
    
    container.innerHTML = '';
    
    if (!currentRoom || !messages[currentRoom.id] || messages[currentRoom.id].length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--medium-teal);">No messages yet. Start the conversation!</div>';
        return;
    }
    
    // Sort messages by ID to maintain order
    const sortedMessages = [...messages[currentRoom.id]].sort((a, b) => a.id - b.id);
    
    sortedMessages.forEach(msg => {
        const messageDiv = createMessageElement(msg);
        container.appendChild(messageDiv);
    });
    
    scrollToBottom();
}

function createMessageElement(msg) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.dataset.messageId = msg.id;
    
    const isOwnMessage = msg.username === currentUsername;
    
    let html = `
        <div class="message-header">
            <span class="message-username">${msg.username}</span>
            <span class="message-timestamp">${formatTime(msg.timestamp)}</span>
        </div>
    `;
    
    if (msg.replyTo) {
        // Handle both cases: full object or just ID
        const replyContent = msg.replyTo.content || 
                           messages[currentRoom.id]?.find(m => m.id === msg.replyTo)?.content ||
                           'Message';
        html += `
            <div class="message-reply-preview">
                Replying to: ${escapeHtml(replyContent)}
            </div>
        `;
    }
    
    html += `<div class="message-content">${escapeHtml(msg.content)}</div>`;
    
    // Add reactions
    if (msg.reactions && msg.reactions.length > 0) {
        const reactionGroups = {};
        msg.reactions.forEach(r => {
            if (!reactionGroups[r.emoji]) {
                reactionGroups[r.emoji] = [];
            }
            reactionGroups[r.emoji].push(r.username);
        });
        
        html += '<div class="message-reactions">';
        Object.entries(reactionGroups).forEach(([emoji, users]) => {
            const userReacted = users.includes(currentUsername);
            html += `
                <div class="reaction ${userReacted ? 'user-reacted' : ''}" onclick="toggleReaction(${msg.id}, '${emoji}')">
                    <span>${emoji}</span>
                    <span class="reaction-count">${users.length}</span>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Add action buttons for everyone (reply + react)
    html += `
        <div class="message-actions">
            <button class="icon-btn" onclick="replyToMsg(${msg.id})" title="Reply">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 14 4 9 9 4"></polyline>
                    <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                </svg>
            </button>
            <button class="icon-btn" onclick="showEmojiPickerForMessage(event, ${msg.id})" title="React">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                </svg>
            </button>
    `;
    
    // Add edit/delete only for own messages
    if (isOwnMessage) {
        html += `
            <button class="icon-btn" onclick="editMessage(${msg.id})" title="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            </button>
            <button class="icon-btn" onclick="deleteMessage(${msg.id})" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `;
    }
    
    html += '</div>';
    
    messageDiv.innerHTML = html;
    return messageDiv;
}

function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        console.warn('Invalid timestamp:', timestamp);
        return 'Just now';
    }
    
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content || !currentRoom || !stompClient) return;
    
    if (editingMessageId) {
        // Update message
        stompClient.send(`/app/rooms/${currentRoom.id}/message`, {}, JSON.stringify({
            id: editingMessageId,
            username: currentUsername,
            content: content,
            type: 'UPDATE'
        }));
        
        editingMessageId = null;
    } else {
        // New message
        const message = {
            username: currentUsername,
            content: content,
            type: 'POST'
        };
        
        if (replyToMessage) {
            message.replyTo = replyToMessage;
        }
        
        stompClient.send(`/app/rooms/${currentRoom.id}/message`, {}, JSON.stringify(message));
    }
    
    input.value = '';
    cancelReply();
    sendTypingStatus(false);
}

function handleTyping() {
    if (!currentRoom || !stompClient) return;
    
    sendTypingStatus(true);
    
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    typingTimeout = setTimeout(() => {
        sendTypingStatus(false);
    }, 3000);
}

function sendTypingStatus(isTyping) {
    if (!currentRoom || !stompClient) return;
    
    stompClient.send(`/app/rooms/${currentRoom.id}/typing`, {}, JSON.stringify({
        username: currentUsername,
        typing: isTyping
    }));
}

function replyToMsg(messageId) {
    const msg = messages[currentRoom.id].find(m => m.id === messageId);
    if (!msg) return;
    
    replyToMessage = messageId;
    document.getElementById('replyPreview').style.display = 'flex';
    document.getElementById('replyText').textContent = `Replying to ${msg.username}: ${msg.content}`;
    document.getElementById('messageInput').focus();
}

function cancelReply() {
    replyToMessage = null;
    document.getElementById('replyPreview').style.display = 'none';
}

function editMessage(messageId) {
    const msg = messages[currentRoom.id].find(m => m.id === messageId);
    if (!msg) return;
    
    editingMessageId = messageId;
    document.getElementById('messageInput').value = msg.content;
    document.getElementById('messageInput').focus();
}

function deleteMessage(messageId) {
    if (!confirm('Delete this message?')) return;
    
    if (!stompClient || !currentRoom) return;
    
    
    stompClient.send(`/app/rooms/${currentRoom.id}/message`, {}, JSON.stringify({
        id: messageId,
        type: 'DELETE'
    }));
}

function showEmojiPickerForMessage(event, messageId) {
    event.stopPropagation();
    emojiPickerTarget = messageId;
    
    const picker = document.getElementById('emojiPicker');
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    picker.style.display = 'block';
    
    const pickerWidth = 210;
    const pickerHeight = 150;
    
    // Position to the left of the button, above it
    let left = rect.left - pickerWidth - 10;
    let top = rect.top - pickerHeight / 2 + rect.height / 2;
    
    // Keep within viewport
    if (left < 10) {
        left = rect.right + 10; // Show on right if no space on left
    }
    
    if (top < 10) {
        top = 10;
    }
    
    if (top + pickerHeight > window.innerHeight - 10) {
        top = window.innerHeight - pickerHeight - 10;
    }
    
    picker.style.top = `${top}px`;
    picker.style.left = `${left}px`;
}

function setupEmojiPicker() {
    const grid = document.getElementById('emojiGrid');
    grid.innerHTML = '';
    
    emojis.forEach(emoji => {
        const item = document.createElement('div');
        item.className = 'emoji-item';
        item.textContent = emoji;
        item.onclick = () => selectEmoji(emoji);
        grid.appendChild(item);
    });
}

function selectEmoji(emoji) {
    if (!emojiPickerTarget || !stompClient || !currentRoom) return;
    
    // Check if user already reacted
    const msg = messages[currentRoom.id].find(m => m.id === emojiPickerTarget);
    const userReaction = msg?.reactions?.find(r => r.username === currentUsername);
    
    if (userReaction) {
        // Update reaction
        stompClient.send(`/app/rooms/${currentRoom.id}/react`, {}, JSON.stringify({
            messageId: emojiPickerTarget,
            username: currentUsername,
            emoji: emoji,
            type: 'UPDATE'
        }));
    } else {
        // New reaction
        stompClient.send(`/app/rooms/${currentRoom.id}/react`, {}, JSON.stringify({
            messageId: emojiPickerTarget,
            username: currentUsername,
            emoji: emoji,
            type: 'POST'
        }));
    }
    
    document.getElementById('emojiPicker').style.display = 'none';
    emojiPickerTarget = null;
}

function toggleReaction(messageId, emoji) {
    if (!stompClient || !currentRoom) return;
    
    const msg = messages[currentRoom.id].find(m => m.id === messageId);
    const userReaction = msg?.reactions?.find(r => r.username === currentUsername);
    
    if (userReaction) {
        // Remove reaction
        stompClient.send(`/app/rooms/${currentRoom.id}/react`, {}, JSON.stringify({
            messageId: messageId,
            username: currentUsername,
            type: 'DELETE'
        }));
    } else {
        // Add reaction
        stompClient.send(`/app/rooms/${currentRoom.id}/react`, {}, JSON.stringify({
            messageId: messageId,
            username: currentUsername,
            emoji: emoji,
            type: 'POST'
        }));
    }
}

async function showRoomMembers() {
    if (!currentRoom) return;
    
    try {
        const response = await api.getRoomMembers(currentRoom.id);
        if (response.ok) {
            const members = await response.json();
            const membersList = document.getElementById('membersList');
            membersList.innerHTML = '';
            
            members.forEach(member => {
                const memberDiv = document.createElement('div');
                memberDiv.className = 'member-item';
                memberDiv.textContent = member;
                membersList.appendChild(memberDiv);
            });
            
            openModal('inviteMembersModal');
        }
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

async function inviteUser() {
    const username = document.getElementById('inviteUsername').value.trim();
    
    if (!username || !currentRoom) return;
    
    try {
        const response = await api.inviteUsers(currentRoom.id, [username]);
        if (response.ok) {
            document.getElementById('inviteUsername').value = '';
            showRoomMembers(); // Refresh members list
        } else {
            alert('Failed to invite user');
        }
    } catch (error) {
        console.error('Error inviting user:', error);
        alert('Could not invite user');
    }
}

async function deleteCurrentRoom() {
    if (!currentRoom) return;
    
    if (!confirm(`Delete room "${currentRoom.name}"? This cannot be undone.`)) return;
    
    try {
        const response = await api.deleteRoom(currentRoom.id);
        if (response.ok) {
            currentRoom = null;
            await loadRooms();
            
            // Reset chat area
            document.getElementById('currentRoomName').textContent = 'Select a room';
            document.getElementById('roomMembersBtn').style.display = 'none';
            document.getElementById('deleteRoomBtn').style.display = 'none';
            document.getElementById('messageInputContainer').style.display = 'none';
            
            const container = document.getElementById('messagesContainer');
            container.innerHTML = `
                <div class="no-room-selected">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <p>Select a room to start chatting</p>
                </div>
            `;
        } else if (response.status === 403) {
            alert('You do not have permission to delete this room');
        }
    } catch (error) {
        console.error('Error deleting room:', error);
        alert('Could not delete room');
    }
}

// WebSocket Connection
function connectWebSocket() {
    const token = localStorage.getItem('token');
    const socket = new SockJS(CONFIG.WS_BASE);
    stompClient = Stomp.over(socket);
    
    stompClient.connect(
        { Authorization: `Bearer ${token}` },
        (frame) => {
            
            // If a room is already selected, subscribe to it
            if (currentRoom) {
                subscribeToRoom(currentRoom.id);
            }
        },
        (error) => {
            console.error('WebSocket error:', error);
            // Attempt reconnection
            setTimeout(connectWebSocket, 5000);
        }
    );
}

function subscribeToRoom(roomId) {
    if (!stompClient || !stompClient.connected) {
        console.error('STOMP client not connected');
        return;
    }
    
    
    // Subscribe to messages
    stompClient.subscribe(`/topic/${roomId}/messages`, (message) => {
        const msg = JSON.parse(message.body);
        msg.roomId = roomId; // Add roomId if not present
        handleIncomingMessage(msg);
    });
    
    // Subscribe to reactions
    stompClient.subscribe(`/topic/${roomId}/reactions`, (message) => {
        const reaction = JSON.parse(message.body);
        handleIncomingReaction(reaction);
    });
    
    // Subscribe to typing indicators
    stompClient.subscribe(`/topic/${roomId}/typing`, (message) => {
        const data = JSON.parse(message.body);
        handleTypingIndicator(data);
    });
    
    // Subscribe to notes
    stompClient.subscribe(`/topic/${roomId}/notes`, (message) => {
        const note = JSON.parse(message.body);
    });
}

function handleIncomingMessage(msg) {
    
    if (!currentRoom || msg.roomId != currentRoom.id) { // Use loose equality
        return;
    }
    
    if (!messages[currentRoom.id]) {
        messages[currentRoom.id] = [];
    }
    
    if (msg.type === 'POST') {
        // Check if message already exists (avoid duplicates)
        const exists = messages[currentRoom.id].find(m => m.id === msg.id);
        if (!exists) {
            messages[currentRoom.id].push(msg);
        } else {
        }
    } else if (msg.type === 'UPDATE') {
        const index = messages[currentRoom.id].findIndex(m => m.id === msg.id);
        if (index !== -1) {
            // Preserve reactions when updating
            const existingReactions = messages[currentRoom.id][index].reactions || [];
            messages[currentRoom.id][index] = { 
                ...messages[currentRoom.id][index], 
                content: msg.content,
                reactions: existingReactions
            };
        }
    } else if (msg.type === 'DELETE') {
        messages[currentRoom.id] = messages[currentRoom.id].filter(m => m.id !== msg.id);
    }
    
    renderMessages();
}

function handleIncomingReaction(reaction) {
    
    if (!currentRoom) return;
    
    const msg = messages[currentRoom.id]?.find(m => m.id === reaction.messageId);
    if (!msg) return;
    
    if (!msg.reactions) {
        msg.reactions = [];
    }
    
    if (reaction.type === 'POST') {
        // Check if reaction already exists
        const exists = msg.reactions.find(r => 
            r.username === reaction.username && r.messageId === reaction.messageId
        );
        if (!exists) {
            msg.reactions.push(reaction);
        }
    } else if (reaction.type === 'UPDATE') {
        const index = msg.reactions.findIndex(r => r.username === reaction.username);
        if (index !== -1) {
            msg.reactions[index] = reaction;
        }
    } else if (reaction.type === 'DELETE') {
        msg.reactions = msg.reactions.filter(r => r.username !== reaction.username);
    }
    
    renderMessages();
}

function handleTypingIndicator(data) {
    if (data.username === currentUsername) return;
    
    const indicator = document.getElementById('typingIndicator');
    
    if (data.typing) {
        indicator.textContent = `${data.username} is typing...`;
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}