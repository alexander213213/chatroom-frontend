document.addEventListener('DOMContentLoaded', () => {
    if (session.token && session.isValid()) {
        window.location.replace('chat.html');
        return;
    }
    const form = document.getElementById('loginForm') || document.getElementById('signupForm');
    form.addEventListener('submit', e => {
        e.preventDefault();
        submit(form, form.id === 'signupForm');
    });
});

// Mirrors the backend's /auth/register rules so users get feedback before the round trip
function validateSignup(username, password) {
    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username) || username.includes('..')) {
        return 'Username must be 3-32 characters: letters, digits, _ . -';
    }
    if (password.length < 8 || password.length > 72) {
        return 'Password must be 8-72 characters';
    }
    return null;
}

async function submit(form, isSignup) {
    const username = form.username.value.trim();
    const password = form.password.value;
    const button = form.querySelector('button[type="submit"]');
    const label = button.textContent;

    if (!username || !password) return showError('Please fill in all fields');
    const invalid = isSignup && validateSignup(username, password);
    if (invalid) return showError(invalid);

    showError(null);
    button.disabled = true;
    button.textContent = isSignup ? 'Creating account...' : 'Logging in...';

    try {
        if (isSignup) {
            const res = await api.register(username, password);
            if (!res.ok) {
                return showError(res.status === 409 ? 'That username is taken' : await errorText(res));
            }
        }
        const res = await api.login(username, password);
        if (!res.ok) {
            return showError(res.status === 401 ? 'Invalid username or password' : await errorText(res));
        }
        session.save(await res.text(), username);
        window.location.replace('chat.html');
    } catch {
        showError('Could not reach the server. Is it running?');
    } finally {
        button.disabled = false;
        button.textContent = label;
    }
}

function showError(message) {
    const el = document.getElementById('errorMessage');
    el.textContent = message || '';
    el.hidden = !message;
}
