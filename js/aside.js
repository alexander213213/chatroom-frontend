// File management system
let filesData = [
    { name: 'RegistrationCertificate (4).pdf', size: '495.46 KB', type: 'pdf', category: 'Documents' },
    { name: 'Online-Class-Agreement-Gonzales-.pdf', size: '297.07 KB', type: 'pdf', category: 'Documents' },
    { name: 'Project-Demo.mp4', size: '125.34 MB', type: 'mp4', category: 'Video' },
    { name: 'Profile-Photo.jpg', size: '2.45 MB', type: 'jpg', category: 'Images' },
    { name: 'Screenshot.png', size: '856.23 KB', type: 'png', category: 'Images' }
];

let filteredFiles = [...filesData];

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
    default: '📁'
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

function getFileCategory(filename) {
    const type = getFileType(filename);
    if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(type)) return 'Documents';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(type)) return 'Images';
    if (['mp3'].includes(type)) return 'Audio';
    if (['mp4'].includes(type)) return 'Video';
    if (['zip', 'rar'].includes(type)) return 'Archives';
    return 'Other';
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

function handleFileDownload(event, fileName) {
    event.stopPropagation();
    console.log(`Downloading: ${fileName}`);
    handleFileClick(fileName);
}

function handleFileDelete(event, fileName) {
    event.stopPropagation();
    if (confirm(`Delete "${fileName}"?`)) {
        filesData = filesData.filter(f => f.name !== fileName);
        applyFiltersAndSort();
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

function handleFileUpload(files) {
    Array.from(files).forEach(file => {
        filesData.push({
            name: file.name,
            size: (file.size / 1024).toFixed(2) + ' KB',
            type: getFileType(file.name),
            category: getFileCategory(file.name)
        });
    });
    applyFiltersAndSort();
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
});

//Toggle element of members
function toggleMemberNotes(headerElement) {
    const item = headerElement.closest('.member-note-item');
    item.classList.toggle('active');
}

//Used for saving and creating new note after clicking plus button, buttons on note entry, note viewing modal, etc. - used Ai for help not so confident if it'll work  
let currentEditElement = null;

function saveCurrentNote(event) {
    event.stopPropagation();

    const textarea = document.querySelector('.note_taker');
    const noteText = textarea.value.trim();
    const saveBtn = document.querySelector('.add-note-btn');

    if (!noteText) return;

    if (currentEditElement) {
        const textSpan = currentEditElement.querySelector('.note-text');
        textSpan.textContent = noteText;
        
        currentEditElement.style.backgroundColor = '#e8f8f5';
        setTimeout(() => currentEditElement.style.backgroundColor = 'white', 500);

        currentEditElement = null;
        
        saveBtn.textContent = '+';
        saveBtn.title = 'Save Note';
        saveBtn.classList.remove('btn-warning');

    } else {

        const noteList = document.getElementById('myNotesList');
        const parentItem = noteList.closest('.member-note-item');

        const entryDiv = document.createElement('div');
        entryDiv.className = 'note-entry user-note-entry';

        const textSpan = document.createElement('span');
        textSpan.className = 'note-text';
        textSpan.textContent = noteText;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'note-actions';

        const createBtn = (cls, icon, title, action) => {
            const btn = document.createElement('button');
            btn.className = `action-btn ${cls}`;
            btn.textContent = icon;
            btn.title = title;
            btn.onclick = action;
            return btn;
        };

        actionsDiv.appendChild(createBtn('view', 'o', 'View', function() { viewNote(this) }));
        actionsDiv.appendChild(createBtn('edit', '^', 'Edit', function() { editNote(this) }));
        actionsDiv.appendChild(createBtn('delete', 'x', 'Delete', function() { deleteNote(this) }));

        entryDiv.appendChild(textSpan);
        entryDiv.appendChild(actionsDiv);

        noteList.prepend(entryDiv);
        
        if (!parentItem.classList.contains('active')) {
            parentItem.classList.add('active');
        }
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

document.getElementById('noteViewModal').addEventListener('click', function(e) {
    if (e.target === this) closeNoteModal();
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

function deleteNote(btnElement) {
if(confirm('Are you sure you want to delete this note?')) {
        const entry = btnElement.closest('.note-entry');

        if (currentEditElement === entry) {
            currentEditElement = null;
            document.querySelector('.note_taker').value = '';
            document.querySelector('.add-note-btn').textContent = '+';
        }

        entry.style.opacity = '0';
        setTimeout(() => {
            entry.remove();
        }, 200);
    }
}
//hanggang dito siya 

function handleFileClick(fileName) {
    console.log(`File clicked: ${fileName}`);
    // TODO: Implement file download functionality
    // This could call an API to fetch the file from the backend
    // or trigger a download if the file URL is available
}
