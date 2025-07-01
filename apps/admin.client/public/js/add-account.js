// Add Account Page Manager
class AddAccountManager {
    constructor() {
        this.apiBaseUrl = '/api';
        this.currentUser = null;
        this.init();
    }

    init() {
        this.checkAuthAndLoadUser();
        this.bindEvents();
    }

    bindEvents() {
        // Form submission
        document.getElementById('add-account-form').addEventListener('submit', (e) => this.handleAddAccount(e));
    }

    async checkAuthAndLoadUser() {
        // Check if user is logged in via session storage
        const userData = sessionStorage.getItem('simpleAuthUser');
        
        if (!userData) {
            // Redirect to login if not authenticated
            window.location.href = '/login.html';
            return;
        }

        try {
            this.currentUser = JSON.parse(userData);
            await this.loadUserInfo();
        } catch (error) {
            sessionStorage.removeItem('simpleAuthUser');
            window.location.href = '/login.html';
        }
    }

    async loadUserInfo() {
        if (!this.currentUser) return;

        // Update user display
        const displayNameEl = document.getElementById('user-display-name');
        const emailCountEl = document.getElementById('user-email-count');

        displayNameEl.textContent = this.currentUser.displayName || this.currentUser.username;

        // Show current email accounts count
        if (this.currentUser.accounts && Array.isArray(this.currentUser.accounts)) {
            const activeAccounts = this.currentUser.accounts.filter(acc => acc.isActive);
            emailCountEl.textContent = `${activeAccounts.length} email account(s) connected`;
            
            if (activeAccounts.length > 0) {
                emailCountEl.textContent += ` • ${activeAccounts.map(acc => acc.email).join(', ')}`;
            }
        } else {
            emailCountEl.textContent = 'No email accounts connected yet';
        }
    }

    async handleAddAccount(event) {
        event.preventDefault();
        
        if (!this.currentUser) {
            this.showError('Please log in first');
            return;
        }

        const formData = new FormData(event.target);
        const accountData = {
            email: formData.get('email'),
            appPassword: formData.get('appPassword'),
            displayName: formData.get('displayName') || formData.get('email'),
            accountType: formData.get('accountType'),
            userId: this.currentUser.id
        };

        this.setLoading(true);
        this.hideMessages();

        try {
            // First test the IMAP connection
            this.showInfo('Testing IMAP connection...');
            
            const testResponse = await fetch(`${this.apiBaseUrl}/auth/test-imap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: accountData.email,
                    appPassword: accountData.appPassword
                }),
            });

            const testData = await testResponse.json();

            if (!testData.success) {
                this.showError('IMAP connection test failed. Please check your email and app password.');
                return;
            }

            this.showInfo('IMAP connection successful! Adding account...');

            // If test passes, add the account
            const response = await fetch(`${this.apiBaseUrl}/auth/add-account`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(accountData),
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess(`Email account "${accountData.email}" added successfully! You can now process emails from this account.`);
                
                // Clear the form
                document.getElementById('add-account-form').reset();
                
                // Update user info in session storage and display
                if (this.currentUser.accounts) {
                    this.currentUser.accounts.push(data.account);
                } else {
                    this.currentUser.accounts = [data.account];
                }
                sessionStorage.setItem('simpleAuthUser', JSON.stringify(this.currentUser));
                
                // Refresh user info display
                await this.loadUserInfo();

                // Show success actions
                setTimeout(() => {
                    if (confirm('Email account added successfully! Would you like to go to the dashboard to start processing emails?')) {
                        window.location.href = '/data-preview.html';
                    }
                }, 2000);

            } else {
                this.showError(data.message || 'Failed to add email account. Please try again.');
            }
        } catch (error) {
            this.showError('Failed to add email account. Please check your connection and try again.');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(isLoading) {
        const button = document.getElementById('add-account-button');
        const text = document.getElementById('add-account-text');
        const loading = document.getElementById('add-account-loading');

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
        
        // Hide other messages
        document.getElementById('success-message').style.display = 'none';

        // Auto-hide after 8 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 8000);
    }

    showSuccess(message) {
        const successDiv = document.getElementById('success-message');
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        
        // Hide other messages
        document.getElementById('error-message').style.display = 'none';

        // Auto-hide after 10 seconds
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 10000);
    }

    showInfo(message) {
        const successDiv = document.getElementById('success-message');
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        successDiv.style.background = '#bee3f8';
        successDiv.style.color = '#2c5282';
        
        // Hide error message
        document.getElementById('error-message').style.display = 'none';
    }

    hideMessages() {
        document.getElementById('error-message').style.display = 'none';
        document.getElementById('success-message').style.display = 'none';
    }

    logout() {
        sessionStorage.removeItem('simpleAuthUser');
        window.location.href = '/login.html';
    }
}

// Initialize the Add Account Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AddAccountManager();
});

// Global logout function (for navigation links)
function logout() {
    sessionStorage.removeItem('simpleAuthUser');
    window.location.href = '/login.html';
} 