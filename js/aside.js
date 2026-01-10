// File management system
let filesData = [];
let filteredFiles = [];
let notesData = [];

// File type icon mapping
const fileTypeIcons = {
    pdf: '📄',
    doc: '📘',
    docx: '📘',
    txt: '📋',
    xls: '📊',
    xlsx: '📊',
    ppt: '🎬',
    pptx: '🎬',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    zip: '📦',
    rar: '📦',
    mp3: '🎵',
    mp4: '🎬',
    default: '📎'
};

function getFileType(filename) {
    return filename.split('.').pop().toLowerCase();
}

function getFileIcon(filename) {
    const type = getFileType(filename);
    return fileTypeIcons[type] || fileTypeIcons.default;
}

function parseSize(sizeStr) {
    const parts = sizeStr.split(' ');
    const value = parseFloat(parts[0]);
    const unit = parts[1] ? parts[1].toUpperCase() : 'KB';
    
    const multipliers = {
        'B': 1,
        'KB': 1024,
        'MB': 1024 * 1024,
        'GB': 1024 * 1024 * 1024,
        'TB': 1024 * 1024 * 1024 * 1024
    };
    
    return value * (multipliers[unit] || 1);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function getFileCategory(filename) {
    const type = getFileType(filename);
    if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(type)) return 'Documents';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(type)) return 'Images';
    if (['mp3'].includes(type)) return 'Audio';
    if (['mp4'].includes(type)) return 'Video';
    if (['zip', 'rar'].includes(type)) return 'Archives';
    return 'Other';
}

function formatFileTimestamp(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 hour ago
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
    }
    
    // Less than 24 hours ago
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
    }
    
    // Less than 7 days ago
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}d ago`;
    }
    
    // Format as date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function loadRoomFiles(roomId) {
    if (!roomId) {
        filesData = [];
        renderFilesList();
        return;
    }

    try {
        const response = await api.request(`/api/files/rooms/${roomId}/attachments`);
        if (response.ok) {
            const data = await response.json();
            filesData = data.attachments.map(file => ({
                name: file.filename,
                size: formatFileSize(file.size),
                type: getFileType(file.filename),
                category: getFileCategory(file.filename),
                downloadUrl: file.download_url,
                uploadedAt: file.uploaded_at,
                contentType: file.content_type
            }));
            applyFiltersAndSort();
        }
    } catch (error) {
        console.error('Error loading files:', error);
        filesData = [];
        renderFilesList();
    }
}

function renderFilesList() {
    const filesList = document.getElementById('filesList');
    filesList.innerHTML = '';

    if (filteredFiles.length === 0) {
        filesList.innerHTML = '<p style="text-align: center; color: var(--medium-teal); padding: 20px;">No files found</p>';
        updateFileCount();
        return;
    }

    // Group files by category
    const categories = {};
    filteredFiles.forEach(file => {
        const category = file.category;
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push(file);
    });

    // Render categories
    Object.keys(categories).sort().forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'file-category';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'file-category-title';
        titleDiv.textContent = category;
        categoryDiv.appendChild(titleDiv);

        categories[category].forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.style.cursor = 'pointer';
            
            // Create file icon
            const fileIcon = document.createElement('div');
            fileIcon.className = 'file-icon';
            fileIcon.textContent = getFileIcon(file.name);
            
            // Create file info
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            
            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.textContent = file.name;
            
            const fileSize = document.createElement('div');
            fileSize.className = 'file-size';
            // Add timestamp to file size display
            const timestamp = formatFileTimestamp(file.uploadedAt);
            fileSize.textContent = timestamp ? `${file.size} • ${timestamp}` : file.size;
            
            fileInfo.appendChild(fileName);
            fileInfo.appendChild(fileSize);
            
            // Create actions container
            const fileActions = document.createElement('div');
            fileActions.className = 'file-actions';
            
            // Download button
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'file-action-btn download';
            downloadBtn.title = 'Download';
            downloadBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            `;
            
            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'file-action-btn delete';
            deleteBtn.title = 'Delete';
            deleteBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            `;
            
            fileActions.appendChild(downloadBtn);
            fileActions.appendChild(deleteBtn);
            
            // Assemble file item
            fileItem.appendChild(fileIcon);
            fileItem.appendChild(fileInfo);
            fileItem.appendChild(fileActions);
            
            // Add click handler to the file item
            fileItem.addEventListener('click', function(e) {
                console.log('File item clicked:', file.name);
                // Only trigger if not clicking on action buttons
                if (!e.target.closest('.file-action-btn')) {
                    handleFileClick(file.name);
                }
            });
            
            // Add event listeners to action buttons
            downloadBtn.addEventListener('click', function(e) {
                console.log('Download button clicked:', file.name);
                e.stopPropagation();
                handleFileDownload(e, file.name);
            });
            
            deleteBtn.addEventListener('click', function(e) {
                console.log('Delete button clicked:', file.name);
                e.stopPropagation();
                handleFileDelete(e, file.name);
            });
            
            categoryDiv.appendChild(fileItem);
        });

        filesList.appendChild(categoryDiv);
    });

    updateFileCount();
}

function updateFileCount() {
    const badge = document.getElementById('fileCountBadge');
    const count = filesData.length;
    badge.textContent = `${count} file${count !== 1 ? 's' : ''}`;
}

async function handleFileDownload(event, fileName) {
    event.stopPropagation();
    if (!currentRoom) return;
    
    try {
        const file = filesData.find(f => f.name === fileName);
        if (file) {
            // Check if it's an image - open in modal instead of downloading
            if (file.contentType && file.contentType.startsWith('image/')) {
                openImageModal(file.downloadUrl, fileName);
            } else if (file.downloadUrl) {
                // Create temporary link and trigger download
                const a = document.createElement('a');
                a.href = file.downloadUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        alert('Failed to download file');
    }
}

function openImageModal(imageUrl, fileName) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('imageViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'imageViewModal';
        modal.className = 'note-modal';
        modal.innerHTML = `
            <div class="note-modal-content" style="max-width: 90vw; max-height: 90vh;">
                <div class="note-modal-header">
                    <h4 id="imageModalTitle"></h4>
                    <button class="icon-btn-small" onclick="closeImageModal()" title="Close">×</button>
                </div>
                <div class="note-modal-body" style="text-align: center; overflow: auto;">
                    <img id="imageModalImg" style="max-width: 100%; max-height: 70vh; object-fit: contain;" />
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeImageModal();
        });
    }
    
    document.getElementById('imageModalTitle').textContent = fileName;
    document.getElementById('imageModalImg').src = imageUrl;
    modal.style.display = 'flex';
}

function closeImageModal() {
    const modal = document.getElementById('imageViewModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function handleFileDelete(event, fileName) {
    event.stopPropagation();
    if (!currentRoom) return;
    
    if (confirm(`Delete "${fileName}"?`)) {
        try {
            const response = await api.request(`/api/files/rooms/${currentRoom.id}/attachments/${encodeURIComponent(fileName)}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                await loadRoomFiles(currentRoom.id);
            } else {
                alert('Failed to delete file');
            }
        } catch (error) {
            console.error('Error deleting file:', error);
            alert('Failed to delete file');
        }
    }
}

function applyFiltersAndSort() {
    const searchTerm = document.getElementById('fileSearchInput').value.toLowerCase();
    const sortBy = document.getElementById('fileSortSelect').value;

    // Filter
    filteredFiles = filesData.filter(file =>
        file.name.toLowerCase().includes(searchTerm)
    );

    // Sort
    if (sortBy === 'name') {
        filteredFiles.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'size') {
        filteredFiles.sort((a, b) => {
            const sizeA = parseSize(a.size);
            const sizeB = parseSize(b.size);
            return sizeB - sizeA;  // Largest first
        });
    } else if (sortBy === 'type') {
        filteredFiles.sort((a, b) => {
            const typeA = getFileType(a.name);
            const typeB = getFileType(b.name);
            return typeA.localeCompare(typeB);
        });
    }

    renderFilesList();
}

async function handleFileUpload(files) {
    if (!currentRoom) {
        alert('Please select a room first');
        return;
    }

    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/files/rooms/${currentRoom.id}/attachments`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            alert(`Failed to upload ${file.name}`);
        }
    }

    // Reload files after upload
    await loadRoomFiles(currentRoom.id);
}

// Notes Management
async function loadRoomNotes(roomId) {
    if (!roomId) {
        notesData = [];
        renderNotesList();
        return;
    }

    try {
        const response = await api.getNotes(roomId);
        if (response.ok) {
            notesData = await response.json();
            renderNotesList();
        }
    } catch (error) {
        console.error('Error loading notes:', error);
        notesData = [];
        renderNotesList();
    }
}

function renderNotesList() {
    const userNotesContainer = document.querySelector('.user_notes');
    if (!userNotesContainer) return;

    // Clear existing content
    userNotesContainer.innerHTML = '';

    // Group notes by username (case-insensitive grouping)
    const notesByUser = {};
    notesData.forEach(note => {
        // Use the original case for display, but group case-insensitively
        const usernameKey = note.username;
        if (!notesByUser[usernameKey]) {
            notesByUser[usernameKey] = [];
        }
        notesByUser[usernameKey].push(note);
    });

    // Render "Your Notes" section first
    const yourNotesTitle = document.createElement('h4');
    yourNotesTitle.className = 'section-title';
    yourNotesTitle.textContent = 'Your Notes';
    userNotesContainer.appendChild(yourNotesTitle);

    // Find current user's notes (case-insensitive)
    const currentUserNotes = Object.keys(notesByUser).find(
        username => username.toLowerCase() === currentUsername.toLowerCase()
    );

    if (currentUserNotes && notesByUser[currentUserNotes]) {
        const myItem = createMemberNoteItem(currentUserNotes, notesByUser[currentUserNotes], true);
        userNotesContainer.appendChild(myItem);
    } else if (currentUsername) {
        // Show empty state for current user
        const myItem = createMemberNoteItem(currentUsername, [], true);
        userNotesContainer.appendChild(myItem);
    }

    // Check if there are other users with notes (case-insensitive comparison)
    const otherUsers = Object.keys(notesByUser).filter(
        username => username.toLowerCase() !== currentUsername.toLowerCase()
    );
    
    if (otherUsers.length > 0) {
        // Add separator and "Other Members' Notes" title
        const separator = document.createElement('div');
        separator.style.cssText = 'height: 1px; background: var(--border-color); margin: 20px 0 10px 0;';
        userNotesContainer.appendChild(separator);

        const otherNotesTitle = document.createElement('h4');
        otherNotesTitle.className = 'section-title';
        otherNotesTitle.textContent = "Other Members' Notes";
        userNotesContainer.appendChild(otherNotesTitle);

        // Render other users' notes
        otherUsers.forEach(username => {
            const item = createMemberNoteItem(username, notesByUser[username], false);
            userNotesContainer.appendChild(item);
        });
    }
}

function createMemberNoteItem(username, notes, isCurrentUser) {
    const item = document.createElement('div');
    item.className = 'member-note-item' + (isCurrentUser ? ' current-user-item active' : '');

    const header = document.createElement('div');
    header.className = 'member-header';
    header.onclick = function() { toggleMemberNotes(this); };

    const nameSpan = document.createElement('span');
    nameSpan.className = 'member-name';
    nameSpan.textContent = isCurrentUser ? `${username} (You)` : `${username}'s Notes`;

    const headerActions = document.createElement('div');
    headerActions.className = 'header-actions';

    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('class', 'chevron');
    chevron.setAttribute('width', '16');
    chevron.setAttribute('height', '16');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('stroke', 'currentColor');
    chevron.setAttribute('stroke-width', '2');
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '6 9 12 15 18 9');
    chevron.appendChild(polyline);
    headerActions.appendChild(chevron);

    header.appendChild(nameSpan);
    header.appendChild(headerActions);

    const notesList = document.createElement('div');
    notesList.className = 'member-notes-list';
    if (isCurrentUser) {
        notesList.id = 'myNotesList';
    }

    if (notes.length === 0 && !isCurrentUser) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.cssText = 'padding: 10px; color: var(--medium-teal); font-size: 13px; text-align: center;';
        emptyMsg.textContent = 'No notes yet';
        notesList.appendChild(emptyMsg);
    } else {
        notes.forEach(note => {
            const noteEntry = createNoteEntry(note, isCurrentUser);
            notesList.appendChild(noteEntry);
        });
    }

    item.appendChild(header);
    item.appendChild(notesList);

    return item;
}

function createNoteEntry(note, isEditable) {
    const entry = document.createElement('div');
    entry.className = 'note-entry' + (isEditable ? ' user-note-entry' : '');
    entry.dataset.noteId = note.id;

    const textSpan = document.createElement('span');
    textSpan.className = 'note-text';
    textSpan.textContent = note.content;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'note-actions';

    // View button with eye icon
    const viewBtn = document.createElement('button');
    viewBtn.className = 'action-btn view';
    viewBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
    `;
    viewBtn.title = 'View';
    viewBtn.onclick = function() { viewNote(this); };
    actionsDiv.appendChild(viewBtn);

    if (isEditable) {
        // Edit button with pencil icon
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn edit';
        editBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        `;
        editBtn.title = 'Edit';
        editBtn.onclick = function() { editNote(this); };
        actionsDiv.appendChild(editBtn);

        // Delete button with trash icon
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete';
        deleteBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        `;
        deleteBtn.title = 'Delete';
        deleteBtn.onclick = function() { deleteNote(this); };
        actionsDiv.appendChild(deleteBtn);
    }

    entry.appendChild(textSpan);
    entry.appendChild(actionsDiv);

    return entry;
}

document.addEventListener('DOMContentLoaded', () => {
    const notesTabBtn = document.getElementById('notesTabBtn');
    const filesTabBtn = document.getElementById('filesTabBtn');
    const noteContainer = document.getElementById('noteContainer');
    const filesContainer = document.getElementById('filesContainer');

    function switchAsideTab(tabName) {
        if (tabName === 'notes') {
            notesTabBtn.classList.add('active');
            filesTabBtn.classList.remove('active');
            filesContainer.style.display = 'none';
            noteContainer.style.display = 'flex';
        } else if (tabName === 'files') {
            filesTabBtn.classList.add('active');
            notesTabBtn.classList.remove('active');
            filesContainer.style.display = 'flex'; 
            noteContainer.style.display = 'none';
        }
    }

    if (notesTabBtn && filesTabBtn) {
        notesTabBtn.addEventListener('click', () => switchAsideTab('notes'));
        filesTabBtn.addEventListener('click', () => switchAsideTab('files'));
    }

    // File search
    const fileSearchInput = document.getElementById('fileSearchInput');
    if (fileSearchInput) {
        fileSearchInput.addEventListener('input', applyFiltersAndSort);
    }

    // File sort
    const fileSortSelect = document.getElementById('fileSortSelect');
    if (fileSortSelect) {
        fileSortSelect.addEventListener('change', applyFiltersAndSort);
    }

    // Add save button to note writing area
    const writingDiv = document.querySelector('.writing');
    if (writingDiv && !document.getElementById('saveNoteBtn')) {
        const saveBtn = document.createElement('button');
        saveBtn.id = 'saveNoteBtn';
        saveBtn.className = 'btn-primary';
        saveBtn.style.cssText = 'margin-top: 10px; width: 100%;';
        saveBtn.textContent = 'Save Note';
        saveBtn.onclick = function(e) { saveCurrentNote(e); };
        writingDiv.appendChild(saveBtn);
    }

    // Initial render
    renderFilesList();
    renderNotesList();
});

// Global function to handle file uploads from chat.js
window.handleAsideFileUpload = handleFileUpload;

// Toggle element of members
function toggleMemberNotes(headerElement) {
    const item = headerElement.closest('.member-note-item');
    item.classList.toggle('active');
}

// Note management functions
let currentEditElement = null;

async function saveCurrentNote(event) {
    event.stopPropagation();

    const textarea = document.querySelector('.note_taker');
    const noteText = textarea.value.trim();
    const saveBtn = document.getElementById('saveNoteBtn');

    if (!noteText || !currentRoom || !stompClient) {
        if (!noteText) alert('Please enter some text for your note');
        return;
    }

    if (currentEditElement) {
        // Update existing note
        const noteId = parseInt(currentEditElement.dataset.noteId);
        
        stompClient.send(`/app/rooms/${currentRoom.id}/note`, {}, JSON.stringify({
            id: noteId,
            roomId: currentRoom.id,
            username: currentUsername,
            content: noteText,
            type: 'UPDATE'
        }));

        currentEditElement = null;
        if (saveBtn) {
            saveBtn.textContent = 'Save Note';
        }
    } else {
        // Create new note
        stompClient.send(`/app/rooms/${currentRoom.id}/note`, {}, JSON.stringify({
            roomId: currentRoom.id,
            username: currentUsername,
            content: noteText,
            type: 'POST'
        }));
    }

    textarea.value = '';
}

function viewNote(btnElement) {
    const entry = btnElement.closest('.note-entry');
    const text = entry.querySelector('.note-text').textContent;

    document.getElementById('noteModalText').textContent = text;
    document.getElementById('noteViewModal').style.display = 'flex';
}

function closeNoteModal() {
    document.getElementById('noteViewModal').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('noteViewModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) closeNoteModal();
        });
    }
});

function editNote(btnElement) {
    const entry = btnElement.closest('.note-entry');
    const text = entry.querySelector('.note-text').textContent;
    const textarea = document.querySelector('.note_taker');
    const saveBtn = document.getElementById('saveNoteBtn');

    currentEditElement = entry;

    textarea.value = text;
    textarea.focus();

    if (saveBtn) {
        saveBtn.textContent = 'Update Note';
    }

    textarea.scrollTop = 0;
}

async function deleteNote(btnElement) {
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    const entry = btnElement.closest('.note-entry');
    const noteId = parseInt(entry.dataset.noteId);

    if (!currentRoom || !stompClient) return;

    if (currentEditElement === entry) {
        currentEditElement = null;
        document.querySelector('.note_taker').value = '';
        const saveBtn = document.getElementById('saveNoteBtn');
        if (saveBtn) {
            saveBtn.textContent = 'Save Note';
        }
    }

    stompClient.send(`/app/rooms/${currentRoom.id}/note`, {}, JSON.stringify({
        id: noteId,
        type: 'DELETE'
    }));
}

function handleFileClick(fileName) {
    const file = filesData.find(f => f.name === fileName);
    if (!file) return;
    
    // Check if it's an image - open in modal instead of downloading
    if (file.contentType && file.contentType.startsWith('image/')) {
        openImageModal(file.downloadUrl, fileName);
    } else if (file.downloadUrl) {
        // Download the file
        const a = document.createElement('a');
        a.href = file.downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// Handle incoming notes from WebSocket
function handleIncomingNote(note) {
    if (!currentRoom || note.roomId != currentRoom.id) return;

    // Handle notes from REST endpoint (type: NONE) and WebSocket (type: POST/UPDATE/DELETE)
    if (note.type === 'POST' || note.type === 'NONE') {
        // Add new note or note from GET endpoint
        const exists = notesData.find(n => n.id === note.id);
        if (!exists) {
            notesData.push(note);
        }
    } else if (note.type === 'UPDATE') {
        // Update existing note
        const index = notesData.findIndex(n => n.id === note.id);
        if (index !== -1) {
            notesData[index] = note;
        }
    } else if (note.type === 'DELETE') {
        // Remove note
        notesData = notesData.filter(n => n.id !== note.id);
    }

    renderNotesList();
}