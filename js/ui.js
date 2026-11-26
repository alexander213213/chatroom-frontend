// Small UI helpers shared by every page
const ui = {
    esc(text) {
        return String(text ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    },

    toast(message, type = 'info', ms = 3500) {
        let stack = document.querySelector('.toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'toast-stack';
            stack.setAttribute('role', 'status');
            stack.setAttribute('aria-live', 'polite');
            document.body.appendChild(stack);
        }
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = message;
        stack.appendChild(el);
        setTimeout(() => el.remove(), ms);
    },

    error(err) {
        ui.toast(err?.message || String(err), 'error');
    },

    openModal(id) {
        const modal = document.getElementById(id);
        modal.classList.add('show');
        modal.querySelector('input, textarea, .btn-primary')?.focus();
    },

    closeModal(id) {
        document.getElementById(id)?.classList.remove('show');
    },

    // Styled replacement for window.confirm; resolves true/false
    confirm(message, { title = 'Are you sure?', okText = 'Confirm', danger = true } = {}) {
        let modal = document.getElementById('confirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'confirmModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle">
                    <div class="modal-header"><h3 id="confirmTitle"></h3></div>
                    <div class="modal-body"><p id="confirmText"></p></div>
                    <div class="modal-footer">
                        <button class="btn" data-answer="no">Cancel</button>
                        <button class="btn" data-answer="yes" id="confirmOk"></button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        }
        modal.querySelector('#confirmTitle').textContent = title;
        modal.querySelector('#confirmText').textContent = message;
        const ok = modal.querySelector('#confirmOk');
        ok.textContent = okText;
        ok.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;

        return new Promise(resolve => {
            const done = answer => {
                modal.classList.remove('show');
                modal.removeEventListener('click', onClick);
                document.removeEventListener('keydown', onKey);
                resolve(answer);
            };
            const onClick = e => {
                if (e.target === modal) return done(false);
                const btn = e.target.closest('[data-answer]');
                if (btn) done(btn.dataset.answer === 'yes');
            };
            const onKey = e => { if (e.key === 'Escape') done(false); };
            modal.addEventListener('click', onClick);
            document.addEventListener('keydown', onKey);
            modal.classList.add('show');
            ok.focus();
        });
    },

    // Initials always render; the image covers them once it loads
    avatarHtml(username, size = '') {
        const name = ui.esc(username);
        const src = `${CONFIG.API_BASE}/api/files/avatars/${encodeURIComponent(username)}?v=${ui.avatarVersion(username)}`;
        const img = ui.noAvatar.has(username) ? ''
            : `<img src="${src}" alt="" loading="lazy" onerror="ui.noAvatar.add(this.parentNode.dataset.avatar); this.remove()">`;
        return `<span class="avatar ${size}" data-avatar="${name}" title="${name}">${name.charAt(0)}${img}</span>`;
    },

    // Users whose avatar 404'd, so re-renders don't refetch it
    noAvatar: new Set(),

    // Bumped after an avatar upload so cached images refresh
    avatarVersions: {},
    avatarVersion(username) {
        return ui.avatarVersions[username] || 0;
    },

    // The backend sends LocalDateTime in UTC with no zone suffix; mark it so browsers don't read it as local time
    utc(value) {
        if (!value) return null;
        return /(Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`;
    },

    formatSize(bytes) {
        if (bytes == null) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
        return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    },

    relativeTime(value) {
        const date = value ? new Date(value) : null;
        if (!date || isNaN(date)) return '';
        const diff = Date.now() - date;
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
};

// Close any modal on backdrop click, Escape, or a [data-close] button
document.addEventListener('click', e => {
    const closer = e.target.closest('[data-close]');
    if (closer) ui.closeModal(closer.closest('.modal').id);
    else if (e.target.classList.contains('modal') && e.target.id !== 'confirmModal') ui.closeModal(e.target.id);
});
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal.show:not(#confirmModal)').forEach(m => ui.closeModal(m.id));
});
