// Secure Password Manager with Encryption
class SecurePasswordManager {
    constructor() {
        this.masterKey = null;
        this.vault = [];
        this.settings = {
            autoLock: true,
            clipboardClear: true,
            lockTimeout: 5 * 60 * 1000, // 5 minutes
            clipboardTimeout: 30 * 1000 // 30 seconds
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingVault();
    }

    // Crypto Functions
    async deriveKey(password, salt) {
        // In production, use PBKDF2 or Argon2
        const iterations = 100000;
        return CryptoJS.PBKDF2(password, salt, {
            keySize: 256/32,
            iterations: iterations
        }).toString();
    }

    encrypt(data, key) {
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key);
        return encrypted.toString();
    }

    decrypt(encryptedData, key) {
        try {
            const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
            return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
        } catch {
            return null;
        }
    }

    generateSalt() {
        return CryptoJS.lib.WordArray.random(128/8).toString();
    }

    // Vault Management
    async createVault(masterPassword) {
        const salt = this.generateSalt();
        this.masterKey = await this.deriveKey(masterPassword, salt);
        
        const vaultData = {
            salt: salt,
            data: this.encrypt([], this.masterKey),
            settings: this.settings
        };
        
        this.saveToStorage('vault', vaultData);
        this.vault = [];
        return true;
    }

    async unlockVault(masterPassword) {
        const vaultData = this.loadFromStorage('vault');
        if (!vaultData) return false;
        
        const key = await this.deriveKey(masterPassword, vaultData.salt);
        const decrypted = this.decrypt(vaultData.data, key);
        
        if (decrypted !== null) {
            this.masterKey = key;
            this.vault = decrypted;
            this.settings = vaultData.settings || this.settings;
            return true;
        }
        return false;
    }

    lockVault() {
        this.masterKey = null;
        this.vault = [];
        this.showLogin();
    }

    saveVault() {
        if (!this.masterKey) return;
        
        const vaultData = this.loadFromStorage('vault');
        vaultData.data = this.encrypt(this.vault, this.masterKey);
        vaultData.settings = this.settings;
        this.saveToStorage('vault', vaultData);
    }

    // Password Management
    generatePassword(options = {}) {
        const defaults = {
            length: 20,
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: true,
            avoidSimilar: false,
            requireAll: false
        };
        
        const opts = { ...defaults, ...options };
        let charset = '';
        let password = '';
        
        const charsets = {
            uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            lowercase: 'abcdefghijklmnopqrstuvwxyz',
            numbers: '0123456789',
            symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
        };
        
        if (opts.avoidSimilar) {
            charsets.uppercase = charsets.uppercase.replace(/[O]/g, '');
            charsets.lowercase = charsets.lowercase.replace(/[l]/g, '');
            charsets.numbers = charsets.numbers.replace(/[01]/g, '');
        }
        
        const activeCharsets = [];
        if (opts.uppercase) { charset += charsets.uppercase; activeCharsets.push(charsets.uppercase); }
        if (opts.lowercase) { charset += charsets.lowercase; activeCharsets.push(charsets.lowercase); }
        if (opts.numbers) { charset += charsets.numbers; activeCharsets.push(charsets.numbers); }
        if (opts.symbols) { charset += charsets.symbols; activeCharsets.push(charsets.symbols); }
        
        if (!charset) return '';
        
        // Ensure at least one character from each selected type
        if (opts.requireAll) {
            activeCharsets.forEach(set => {
                password += this.getRandomChar(set);
            });
        }
        
        // Fill the rest
        for (let i = password.length; i < opts.length; i++) {
            password += this.getRandomChar(charset);
        }
        
        // Shuffle
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    getRandomChar(str) {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return str[array[0] % str.length];
    }

    calculateStrength(password) {
        if (!password) return { score: 0, text: 'No password', entropy: 0 };
        
        let charsetSize = 0;
        if (/[a-z]/.test(password)) charsetSize += 26;
        if (/[A-Z]/.test(password)) charsetSize += 26;
        if (/[0-9]/.test(password)) charsetSize += 10;
        if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;
        
        const entropy = Math.log2(Math.pow(charsetSize, password.length));
        
        let score = 0;
        let text = 'Very Weak';
        
        if (entropy >= 128) { score = 4; text = 'Very Strong'; }
        else if (entropy >= 60) { score = 3; text = 'Strong'; }
        else if (entropy >= 40) { score = 2; text = 'Medium'; }
        else if (entropy >= 20) { score = 1; text = 'Weak'; }
        
        return { score, text, entropy: Math.round(entropy) };
    }

    addPassword(data) {
        const id = crypto.randomUUID();
        const password = {
            id,
            ...data,
            created: Date.now(),
            modified: Date.now()
        };
        
        this.vault.push(password);
        this.saveVault();
        return id;
    }

    updatePassword(id, data) {
        const index = this.vault.findIndex(p => p.id === id);
        if (index !== -1) {
            this.vault[index] = {
                ...this.vault[index],
                ...data,
                modified: Date.now()
            };
            this.saveVault();
        }
    }

    deletePassword(id) {
        this.vault = this.vault.filter(p => p.id !== id);
        this.saveVault();
    }

    searchPasswords(query) {
        if (!query) return this.vault;
        query = query.toLowerCase();
        return this.vault.filter(p => 
            p.title?.toLowerCase().includes(query) ||
            p.username?.toLowerCase().includes(query) ||
            p.url?.toLowerCase().includes(query)
        );
    }

    // Storage (use electron-store or similar in production)
    saveToStorage(key, value) {
        // In Electron/Tauri, use secure storage
        // For demo, using sessionStorage
        sessionStorage.setItem(key, JSON.stringify(value));
    }

    loadFromStorage(key) {
        const data = sessionStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    checkExistingVault() {
        const vault = this.loadFromStorage('vault');
        if (vault) {
            this.showLogin();
        } else {
            document.getElementById('newVaultBtn').style.display = 'block';
        }
    }

    // UI Methods
    showLogin() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    }

    showApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        this.renderVault();
        this.startAutoLockTimer();
    }

    renderVault() {
        const grid = document.getElementById('passwordGrid');
        const count = document.getElementById('vaultCount');
        
        count.textContent = `${this.vault.length} passwords`;
        
        if (this.vault.length === 0) {
            grid.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 40px;">No passwords saved yet</div>';
            return;
        }
        
        grid.innerHTML = this.vault.map(p => `
                <div class="password-card" data-id="${p.id}">
                    <div class="password-card-header">
                        <div class="password-card-title">${this.escape(p.title)}</div>
                        <div class="password-card-actions">
                            <button class="btn btn-ghost btn-icon copy-pwd" data-pwd="${this.escape(p.password)}">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="btn btn-ghost btn-icon edit-pwd" data-id="${p.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-ghost btn-icon delete-pwd" data-id="${p.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="password-card-info">
                        <span><i class="fas fa-user"></i> ${this.escape(p.username)}</span>
                        ${p.url ? `<span><i class="fas fa-link"></i> ${this.escape(new URL(p.url).hostname)}</span>` : ''}
                    </div>
                </div>
            `).join('');
        
        this.attachVaultListeners();
    }

    attachVaultListeners() {
        document.querySelectorAll('.copy-pwd').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(btn.dataset.pwd);
                this.showToast('Password copied', 'success');
                
                if (this.settings.clipboardClear) {
                    setTimeout(() => {
                        navigator.clipboard.writeText('');
                    }, this.settings.clipboardTimeout);
                }
            });
        });

        document.querySelectorAll('.edit-pwd').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const pwd = this.vault.find(p => p.id === id);
                if (pwd) this.showPasswordModal(pwd);
            });
        });

        document.querySelectorAll('.delete-pwd').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this password?')) {
                    this.deletePassword(btn.dataset.id);
                    this.renderVault();
                    this.showToast('Password deleted', 'success');
                }
            });
        });
    }

    showPasswordModal(password = null) {
        const modal = document.getElementById('passwordModal');
        const form = document.getElementById('passwordForm');
        
        document.getElementById('modalTitle').textContent = password ? 'Edit Password' : 'Add Password';
        
        if (password) {
            document.getElementById('pTitle').value = password.title || '';
            document.getElementById('pUsername').value = password.username || '';
            document.getElementById('pPassword').value = password.password || '';
            document.getElementById('pUrl').value = password.url || '';
            document.getElementById('pNotes').value = password.notes || '';
            form.dataset.editId = password.id;
        } else {
            form.reset();
            delete form.dataset.editId;
        }
        
        modal.classList.add('active');
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const text = document.getElementById('toastText');
        const icon = toast.querySelector('i');
        
        text.textContent = message;
        toast.className = `toast ${type}`;
        icon.className = type === 'success' ? 'fas fa-check' : 
                       type === 'error' ? 'fas fa-times' : 'fas fa-info';
        
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    startAutoLockTimer() {
        if (!this.settings.autoLock) return;
        
        clearTimeout(this.lockTimer);
        this.lockTimer = setTimeout(() => {
            this.lockVault();
        }, this.settings.lockTimeout);
        
        // Reset timer on activity
        ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => {
                clearTimeout(this.lockTimer);
                this.lockTimer = setTimeout(() => {
                    this.lockVault();
                }, this.settings.lockTimeout);
            }, { passive: true });
        });
    }

    setupEventListeners() {
        // Login
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('masterPassword').value;
            
            if (await this.unlockVault(password)) {
                this.showApp();
                document.getElementById('masterPassword').value = '';
            } else {
                this.showToast('Invalid password', 'error');
            }
        });

        document.getElementById('newVaultBtn').addEventListener('click', async () => {
            const password = prompt('Create a master password:');
            if (password && password.length >= 8) {
                await this.createVault(password);
                this.showApp();
            } else {
                this.showToast('Password must be at least 8 characters', 'error');
            }
        });

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                if (!view) return;
                
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
                
                btn.classList.add('active');
                document.getElementById(view).style.display = 'block';
            });
        });

        // Lock button
        document.getElementById('lockBtn').addEventListener('click', () => {
            this.lockVault();
        });

        // Generator
        const generatePassword = () => {
            const options = {
                length: parseInt(document.getElementById('lengthSlider').value),
                uppercase: document.getElementById('uppercase').checked,
                lowercase: document.getElementById('lowercase').checked,
                numbers: document.getElementById('numbers').checked,
                symbols: document.getElementById('symbols').checked,
                avoidSimilar: document.getElementById('avoidSimilar').checked,
                requireAll: document.getElementById('requireAll').checked
            };
            
            const password = this.generatePassword(options);
            document.getElementById('passwordDisplay').value = password;
            
            const strength = this.calculateStrength(password);
            document.querySelector('.strength-fill').dataset.strength = strength.score;
            document.getElementById('strengthText').textContent = strength.text;
            document.getElementById('entropyText').textContent = `${strength.entropy} bits`;
        };

        document.getElementById('generateBtn').addEventListener('click', generatePassword);
        document.getElementById('regenerateBtn').addEventListener('click', generatePassword);

        document.getElementById('lengthSlider').addEventListener('input', (e) => {
            document.getElementById('lengthValue').textContent = e.target.value;
        });

        document.getElementById('copyBtn').addEventListener('click', () => {
            const password = document.getElementById('passwordDisplay').value;
            if (password) {
                navigator.clipboard.writeText(password);
                this.showToast('Password copied', 'success');
            }
        });

        // Add password
        document.getElementById('addBtn').addEventListener('click', () => {
            this.showPasswordModal();
        });

        // Password form
        document.getElementById('passwordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const data = {
                title: document.getElementById('pTitle').value,
                username: document.getElementById('pUsername').value,
                password: document.getElementById('pPassword').value,
                url: document.getElementById('pUrl').value,
                notes: document.getElementById('pNotes').value
            };
            
            const editId = e.target.dataset.editId;
            if (editId) {
                this.updatePassword(editId, data);
                this.showToast('Password updated', 'success');
            } else {
                this.addPassword(data);
                this.showToast('Password saved', 'success');
            }
            
            document.getElementById('passwordModal').classList.remove('active');
            this.renderVault();
        });

        // Modal close
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('passwordModal').classList.remove('active');
            });
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            const results = this.searchPasswords(e.target.value);
            // Render filtered results
            this.vault = results;
            this.renderVault();
            this.vault = this.loadFromStorage('vault') ? this.decrypt(this.loadFromStorage('vault').data, this.masterKey) : [];
        });

        // Settings
        document.getElementById('autoLock').addEventListener('change', (e) => {
            this.settings.autoLock = e.target.checked;
            this.saveVault();
        });

        document.getElementById('clipboardClear').addEventListener('change', (e) => {
            this.settings.clipboardClear = e.target.checked;
            this.saveVault();
        });
    }
}

// Initialize
const app = new SecurePasswordManager();
