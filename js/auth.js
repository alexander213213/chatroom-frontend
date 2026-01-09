document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = window.location.pathname.includes('login.html');
    const isSignupPage = window.location.pathname.includes('signup.html');
    
    // Check if already logged in
    if (localStorage.getItem('token')) {
        if (isLoginPage || isSignupPage) {
            window.location.href = 'chat.html';
            return;
        }
    }
    
    if (isLoginPage) {
        setupLoginForm();
    } else if (isSignupPage) {
        setupSignupForm();
    }
});

function setupLoginForm() {
    const form = document.getElementById('loginForm');
    const errorDiv = document.getElementById('errorMessage');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.classList.remove('show');
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            showError('Please fill in all fields', errorDiv);
            return;
        }
        
        try {
            const response = await api.login(username, password);
            
            if (response.ok) {
                const token = await response.text();
                localStorage.setItem('token', token);
                localStorage.setItem('username', username);
                window.location.href = 'chat.html';
            } else if (response.status === 401) {
                showError('Invalid username or password', errorDiv);
            } else {
                showError('An error occurred. Please try again.', errorDiv);
            }
        } catch (error) {
            showError('Could not connect to server', errorDiv);
        }
    });
}

function setupSignupForm() {
    const form = document.getElementById('signupForm');
    const errorDiv = document.getElementById('errorMessage');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.classList.remove('show');
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            showError('Please fill in all fields', errorDiv);
            return;
        }
        
        if (password.length < 6) {
            showError('Password must be at least 6 characters', errorDiv);
            return;
        }
        
        try {
            const response = await api.register(username, password);
            
            if (response.ok) {
                // Auto-login after successful registration
                const loginResponse = await api.login(username, password);
                if (loginResponse.ok) {
                    const token = await loginResponse.text();
                    localStorage.setItem('token', token);
                    localStorage.setItem('username', username);
                    window.location.href = 'chat.html';
                }
            } else if (response.status === 409) {
                showError('Username already exists', errorDiv);
            } else {
                showError('An error occurred. Please try again.', errorDiv);
            }
        } catch (error) {
            showError('Could not connect to server', errorDiv);
        }
    });
}

function showError(message, errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
}