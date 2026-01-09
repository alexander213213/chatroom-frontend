document.addEventListener('DOMContentLoaded', () => {
    const filesTabBtn = document.getElementById('filesTabBtn');
    const notesTabBtn = document.getElementById('notesTabBtn');
    const filesContainer = document.getElementById('filesContainer');
    const noteContainer = document.getElementById('noteContainer');

    function switchAsideTab(tabName) {
        if (tabName === 'files') {
            filesTabBtn.classList.add('active');
            notesTabBtn.classList.remove('active');
            
            filesContainer.style.display = 'flex'; 
            noteContainer.style.display = 'none';
        } else if (tabName === 'notes') {
            notesTabBtn.classList.add('active');
            filesTabBtn.classList.remove('active');
            filesContainer.style.display = 'none';
            noteContainer.style.display = 'block';
        }
    }
    if (filesTabBtn && notesTabBtn) {
        filesTabBtn.addEventListener('click', () => switchAsideTab('files'));
        notesTabBtn.addEventListener('click', () => switchAsideTab('notes'));
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

function toggleMemberNotes(headerElement) {
    const item = headerElement.closest('.member-note-item');
    item.classList.toggle('active');
}

function handleFileClick(fileName) {
    console.log(`File clicked: ${fileName}`);
    // TODO: Implement file download functionality
    // This could call an API to fetch the file from the backend
    // or trigger a download if the file URL is available
}
