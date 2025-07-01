// Simple IMAP Authentication Manager
class SimpleAuthManager {
  constructor() {
    this.apiBaseUrl = '/api';
    this.currentUser = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.checkAuthStatus().finally();
  }

  bindEvents() {
    // Tab switching
    document.getElementById('login-tab').addEventListener('click', () => this.switchTab('login'));
    document
      .getElementById('register-tab')
      .addEventListener('click', () => this.switchTab('register'));

    // Form submissions
    document.getElementById('login-form').addEventListener('submit', e => this.handleLogin(e));
    document
      .getElementById('register-form')
      .addEventListener('submit', e => this.handleRegister(e));
  }

  switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.auth-tab').forEach(button => button.classList.remove('active'));
    document.getElementById(`${tab}-tab`).classList.add('active');

    // Show/hide forms
    document.querySelectorAll('.auth-form').forEach(form => form.classList.add('hidden'));
    document.getElementById(`${tab}-form`).classList.remove('hidden');

    // Clear messages
    this.hideMessages();
  }

  async checkAuthStatus() {
    // For Simple IMAP approach, we'll check if user is logged in via session storage
    const userData = sessionStorage.getItem('simpleAuthUser');

    if (userData) {
      try {
        this.currentUser = JSON.parse(userData);

        this.showLoggedInState();
      } catch (error) {
        sessionStorage.removeItem('simpleAuthUser');
      }
    }
  }

  async handleLogin(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const loginData = {
      username: formData.get('username'),
      password: formData.get('password'),
    };

    this.setLoading('login', true);
    this.hideMessages();

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (data.success) {
        // Store user data in session storage for Simple IMAP approach
        this.currentUser = data.user;

        sessionStorage.setItem('simpleAuthUser', JSON.stringify(data.user));

        // Show contextual success message and redirect based on email accounts
        if (data.hasActiveAccounts) {
          this.showSuccess('Login successful! Redirecting to dashboard...');
          this.showLoggedInState();

          // Redirect to dashboard if user has email accounts
          setTimeout(() => {
            window.location.href = '/data-preview.html';
          }, 1500);
        } else {
          this.showSuccess('Login successful! Please add an email account to get started.');
          this.showLoggedInState();

          // Redirect to add-account page if user has no email accounts
          setTimeout(() => {
            window.location.href = '/add-account.html';
          }, 1500);
        }
      } else {
        this.showError(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      this.showError('Login failed. Please check your connection and try again.');
    } finally {
      this.setLoading('login', false);
    }
  }

  async handleRegister(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const registerData = {
      username: formData.get('username'),
      password: formData.get('password'),
      displayName: formData.get('displayName'),
      email: formData.get('email') || undefined,
    };

    this.setLoading('register', true);
    this.hideMessages();

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerData),
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess('Account created successfully! Please log in to continue.');

        // Auto-switch to login tab and pre-fill username
        setTimeout(() => {
          this.switchTab('login');
          document.getElementById('login-username').value = registerData.username;
          document.getElementById('register-form').reset();
        }, 2000);
      } else {
        this.showError(data.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      this.showError('Registration failed. Please check your connection and try again.');
    } finally {
      this.setLoading('register', false);
    }
  }

  setLoading(form, isLoading) {
    const button = document.getElementById(`${form}-button`);
    const text = document.getElementById(`${form}-text`);
    const loading = document.getElementById(`${form}-loading`);

    button.disabled = isLoading;

    if (isLoading) {
      text.classList.add('hidden');
      loading.classList.remove('hidden');
    } else {
      text.classList.remove('hidden');
      loading.classList.add('hidden');
    }
  }

  showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    // Hide success message if shown
    document.getElementById('success-message').style.display = 'none';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }

  showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = message;
    successDiv.style.display = 'block';

    // Hide error message if shown
    document.getElementById('error-message').style.display = 'none';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      successDiv.style.display = 'none';
    }, 5000);
  }

  hideMessages() {
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('success-message').style.display = 'none';
  }

  showLoggedInState() {
    if (this.currentUser) {
      // Show dashboard navigation link
      const dashboardLink = document.getElementById('dashboard-link');
      dashboardLink.classList.remove('hidden');

      // Update subtitle to show logged-in user
      const subtitle = document.querySelector('.login-subtitle');
      subtitle.textContent = `Welcome back, ${this.currentUser.displayName || this.currentUser.username}!`;
    }
  }

  logout() {
    this.currentUser = null;
    sessionStorage.removeItem('simpleAuthUser');
    window.location.reload();
  }
}

// Initialize the Simple Auth Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SimpleAuthManager();
});

// Utility function to get current user (for use in other scripts)
function getCurrentUser() {
  const userData = sessionStorage.getItem('simpleAuthUser');
  return userData ? JSON.parse(userData) : null;
}
