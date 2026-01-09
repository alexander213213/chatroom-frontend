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
            noteContainer.style.display = 'block';
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

    // Add click event listeners to file items
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        item.addEventListener('click', () => {
            const fileName = item.querySelector('.file-name').textContent;
            handleFileClick(fileName);
        });
    });
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
