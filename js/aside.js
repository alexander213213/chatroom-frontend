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
                downloadUrl: file.downloadUrl,
                uploadedAt: file.uploadedAt,
                contentType: file.contentType
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
            fileItem.innerHTML = `
                <div class="file-icon">${getFileIcon(file.name)}</div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${file.size}</div>
                </div>
                <div class="file-actions">
                    <button class="file-action-btn download" title="Download" onclick="handleFileDownload(event, '${file.name}')">⬇️</button>
                    <button class="file-action-btn delete" title="Delete" onclick="handleFileDelete(event, '${file.name}')">✕</button>
                </div>
            `;
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
        if (file && file.downloadUrl) {
            // Create temporary link and trigger download
            const a = document.createElement('a');
            a.href = file.downloadUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        alert('Failed to download file');
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

    // Group notes by username
    const notesByUser = {};
    notesData.forEach(note => {
        if (!notesByUser[note.username]) {
            notesByUser[note.username] = [];
        }
        notesByUser[note.username].push(note);
    });

    // Clear existing member note items (except the template structure)
    const existingItems = userNotesContainer.querySelectorAll('.member-note-item');
    existingItems.forEach(item => item.remove());

    // Render current user's notes first
    if (currentUsername && notesByUser[currentUsername]) {
        const myItem = createMemberNoteItem(currentUsername, notesByUser[currentUsername], true);
        userNotesContainer.appendChild(myItem);
    }

    // Render other users' notes
    Object.keys(notesByUser).forEach(username => {
        if (username !== currentUsername) {
            const item = createMemberNoteItem(username, notesByUser[username], false);
            userNotesContainer.appendChild(item);
        }
    });
}

function createMemberNoteItem(username, notes, isCurrentUser) {
    const item = document.createElement('div');
    item.className = 'member-note-item' + (isCurrentUser ? ' current-user-item active' : '');

    const header = document.createElement('div');
    header.className = 'member-header';
    header.onclick = function() { toggleMemberNotes(this); };

    const nameSpan = document.createElement('span');
    nameSpan.className = 'member-name';
    nameSpan.textContent = isCurrentUser ? 'Me (You)' : username;

    const headerActions = document.createElement('div');
    headerActions.className = 'header-actions';

    if (isCurrentUser) {
        const addBtn = document.createElement('button');
        addBtn.className = 'add-note-btn';
        addBtn.textContent = '+';
        addBtn.title = 'Save note';
        addBtn.onclick = function(e) { saveCurrentNote(e); };
        headerActions.appendChild(addBtn);
    }

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

    notes.forEach(note => {
        const noteEntry = createNoteEntry(note, isCurrentUser);
        notesList.appendChild(noteEntry);
    });

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

    const viewBtn = document.createElement('button');
    viewBtn.className = 'action-btn view';
    viewBtn.textContent = 'o';
    viewBtn.title = 'View';
    viewBtn.onclick = function() { viewNote(this); };
    actionsDiv.appendChild(viewBtn);

    if (isEditable) {
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn edit';
        editBtn.textContent = '^';
        editBtn.title = 'Edit';
        editBtn.onclick = function() { editNote(this); };
        actionsDiv.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete';
        deleteBtn.textContent = 'x';
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

    // Initial render
    renderFilesList();
    renderNotesList();
});

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
    const saveBtn = document.querySelector('.add-note-btn');

    if (!noteText || !currentRoom || !stompClient) return;

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
        saveBtn.textContent = '+';
        saveBtn.title = 'Save Note';
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
    const saveBtn = document.querySelector('.add-note-btn');

    currentEditElement = entry;

    textarea.value = text;
    textarea.focus();

    saveBtn.textContent = '✓';
    saveBtn.title = 'Update Note';

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
        document.querySelector('.add-note-btn').textContent = '+';
    }

    stompClient.send(`/app/rooms/${currentRoom.id}/note`, {}, JSON.stringify({
        id: noteId,
        type: 'DELETE'
    }));
}

function handleFileClick(fileName) {
    console.log(`File clicked: ${fileName}`);
    handleFileDownload({ stopPropagation: () => {} }, fileName);
}

// Handle incoming notes from WebSocket
function handleIncomingNote(note) {
    if (!currentRoom || note.roomId != currentRoom.id) return;

    if (note.type === 'POST') {
        // Add new note
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