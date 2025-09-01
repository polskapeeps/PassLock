const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously } = require('firebase/auth');
const { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } = require('firebase/firestore');
const firebaseConfig = require('./firebaseConfig');
const nodeCrypto = require('crypto');
function deriveKey(masterPassword, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return nodeCrypto.pbkdf2Sync(masterPassword, salt, 100000, 32, 'sha256');
}

function encryptPassword(password, key, saltHex) {
  const iv = nodeCrypto.randomBytes(16);
  const cipher = nodeCrypto.createCipheriv('aes-256-ctr', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(password), 'utf8'), cipher.final()]);
  return { iv: iv.toString('hex'), salt: saltHex, data: encrypted.toString('hex') };
}

function decryptPassword(payload, key) {
  const iv = Buffer.from(payload.iv, 'hex');
  const decipher = nodeCrypto.createDecipheriv('aes-256-ctr', key, iv);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.data, 'hex')), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

// Password Manager Class
class PasswordManager {
  constructor() {
    this.passwords = [];
    this.currentPassword = '';
    this.editingId = null;
    this.isVaultUnlocked = false;
    this.db = null;
    this.auth = null;
    this.uid = null;
    this.userSalt = localStorage.getItem('encryptionSalt');
    this.encKey = null;
    this.init();
  }

  async init() {
    await this.initFirebase();
    this.setupEventListeners();
    this.passwords = await this.loadPasswords();
    this.renderPasswords();
    this.updateEmptyState();
  }

  async initFirebase() {
    const app = initializeApp(firebaseConfig);
    this.auth = getAuth(app);
    this.db = getFirestore(app);
    const userCredential = await signInAnonymously(this.auth);
    this.uid = userCredential.user.uid;
  }

  // Storage Methods
  async loadPasswords() {
    if (!this.db || !this.uid || !this.encKey) return [];
    const snap = await getDocs(collection(this.db, 'users', this.uid, 'passwords'));
    const items = [];
    snap.forEach(docSnap => {
      const data = decryptPassword(docSnap.data(), this.encKey);
      data.id = docSnap.id;
      items.push(data);
    });
    return items;
  }

  async savePasswords() {
    if (!this.db || !this.uid || !this.encKey || !this.userSalt) return;
    await Promise.all(
      this.passwords.map(p => {
        const encrypted = encryptPassword(p, this.encKey, this.userSalt);
        return setDoc(doc(this.db, 'users', this.uid, 'passwords', p.id), encrypted);
      })
    );
  }

  // Password Generation
  generatePassword() {
    const length = parseInt(document.getElementById('lengthSlider').value);
    const uppercase = document.getElementById('uppercase').checked;
    const lowercase = document.getElementById('lowercase').checked;
    const numbers = document.getElementById('numbers').checked;
    const symbols = document.getElementById('symbols').checked;
    const avoidAmbiguous = document.getElementById('avoidAmbiguous').checked;
    const requireAll = document.getElementById('requireAll').checked;
    const excludeChars = document.getElementById('excludeChars').value;

    let chars = '';
    let password = '';
    const charSets = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };

    // Remove ambiguous characters if needed
    if (avoidAmbiguous) {
      charSets.uppercase = charSets.uppercase.replace(/[O]/g, '');
      charSets.lowercase = charSets.lowercase.replace(/[l]/g, '');
      charSets.numbers = charSets.numbers.replace(/[01]/g, '');
      charSets.symbols = charSets.symbols.replace(/[|]/g, '');
    }

    // Remove excluded characters
    if (excludeChars) {
      for (let char of excludeChars) {
        for (let set in charSets) {
          charSets[set] = charSets[set].replace(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
        }
      }
    }

    // Build character set
    if (uppercase) chars += charSets.uppercase;
    if (lowercase) chars += charSets.lowercase;
    if (numbers) chars += charSets.numbers;
    if (symbols) chars += charSets.symbols;

    if (!chars) {
      this.showToast('Please select at least one character type', 'error');
      return '';
    }

    // Require all types if selected
    if (requireAll) {
      const required = [];
      if (uppercase && charSets.uppercase) required.push(this.getRandomChar(charSets.uppercase));
      if (lowercase && charSets.lowercase) required.push(this.getRandomChar(charSets.lowercase));
      if (numbers && charSets.numbers) required.push(this.getRandomChar(charSets.numbers));
      if (symbols && charSets.symbols) required.push(this.getRandomChar(charSets.symbols));

      password = required.join('');

      // Fill rest with random chars
      for (let i = password.length; i < length; i++) {
        password += this.getRandomChar(chars);
      }

      // Shuffle password
      password = password.split('').sort(() => Math.random() - 0.5).join('');
    } else {
      for (let i = 0; i < length; i++) {
        password += this.getRandomChar(chars);
      }
    }

    this.currentPassword = password;
    return password;
  }

  getRandomChar(str) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return str[array[0] % str.length];
  }

  calculateStrength(password) {
    if (!password) return { score: 0, text: 'No password' };

    let score = 0;

    // Length score
    score += Math.min(30, password.length * 2);

    // Character variety
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 10;
    if (/[^a-zA-Z0-9]/.test(password)) score += 20;

    // Pattern penalties
    if (/(.)\1{2,}/.test(password)) score -= 10; // Repeated characters
    if (/^[a-zA-Z]+$/.test(password)) score -= 10; // Only letters
    if (/^[0-9]+$/.test(password)) score -= 10; // Only numbers

    score = Math.max(0, Math.min(100, score));

    let text = 'Very Weak';
    if (score >= 80) text = 'Very Strong';
    else if (score >= 60) text = 'Strong';
    else if (score >= 40) text = 'Medium';
    else if (score >= 20) text = 'Weak';

    return { score, text };
  }

  // Password CRUD Operations
  addPassword(data) {
    const id = Date.now().toString();
    const password = {
      id,
      ...data,
      createdAt: new Date().toISOString()
    };

    this.passwords.push(password);
    this.savePasswords();
    this.renderPasswords();
    this.updateEmptyState();

    return id;
  }

  updatePassword(id, data) {
    const index = this.passwords.findIndex(p => p.id === id);
    if (index !== -1) {
      this.passwords[index] = {
        ...this.passwords[index],
        ...data,
        updatedAt: new Date().toISOString()
      };
      this.savePasswords();
      this.renderPasswords();
    }
  }

  async deletePassword(id) {
    this.passwords = this.passwords.filter(p => p.id !== id);
    if (this.db && this.uid) {
      await deleteDoc(doc(this.db, 'users', this.uid, 'passwords', id));
    }
    await this.savePasswords();
    this.renderPasswords();
    this.updateEmptyState();
  }

  searchPasswords(query) {
    if (!query) return this.passwords;

    query = query.toLowerCase();
    return this.passwords.filter(p =>
      p.siteName.toLowerCase().includes(query) ||
      p.username.toLowerCase().includes(query) ||
      (p.notes && p.notes.toLowerCase().includes(query))
    );
  }

  // UI Methods
  renderPasswords(passwords = this.passwords) {
    const list = document.getElementById('passwordList');

    if (passwords.length === 0) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = passwords.map(p => `
                <div class="password-item" data-id="${p.id}">
                    <div class="password-info">
                        <div class="password-title">
                            <i class="fas fa-globe"></i>
                            ${this.escapeHtml(p.siteName)}
                        </div>
                        <div class="password-details">
                            <span><i class="fas fa-user"></i> ${this.escapeHtml(p.username)}</span>
                            <span><i class="fas fa-clock"></i> ${new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="password-actions">
                        <button class="btn-icon copy-password" data-password="${this.escapeHtml(p.password)}" title="Copy Password">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn-icon view-password" data-id="${p.id}" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon delete-password" data-id="${p.id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');

    this.attachPasswordListeners();
  }

  attachPasswordListeners() {
    // Copy password buttons
    document.querySelectorAll('.copy-password').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const password = btn.dataset.password;
        navigator.clipboard.writeText(password);
        this.showToast('Password copied to clipboard', 'success');
      });
    });

    // View password buttons
    document.querySelectorAll('.view-password').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const password = this.passwords.find(p => p.id === id);
        if (password) {
          this.showPasswordDetails(password);
        }
      });
    });

    // Delete password buttons
    document.querySelectorAll('.delete-password').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('Are you sure you want to delete this password?')) {
          this.deletePassword(id);
          this.showToast('Password deleted', 'warning');
        }
      });
    });
  }

  showPasswordDetails(password) {
    // For now, just show in an alert. You can create a proper modal
    const details = `
Site: ${password.siteName}
Username: ${password.username}
Password: ${password.password}
${password.notes ? `Notes: ${password.notes}` : ''}
Created: ${new Date(password.createdAt).toLocaleString()}
            `.trim();

    alert(details);
  }

  updateEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const passwordList = document.getElementById('passwordList');

    if (this.passwords.length === 0) {
      emptyState.style.display = 'block';
      passwordList.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      passwordList.style.display = 'grid';
    }
  }

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const icon = toast.querySelector('i');

    // Reset classes
    toast.className = 'toast ' + type;

    // Set icon based on type
    icon.className = type === 'success' ? 'fas fa-check-circle' :
      type === 'error' ? 'fas fa-exclamation-circle' :
        'fas fa-info-circle';

    toastMessage.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Master Password Methods
  isMasterPasswordSet() {
    return !!localStorage.getItem('masterPassword');
  }

  async hash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async setMasterPassword(password) {
    const hash = await this.hash(password);
    localStorage.setItem('masterPassword', hash);
    this.userSalt = nodeCrypto.randomBytes(16).toString('hex');
    localStorage.setItem('encryptionSalt', this.userSalt);
    this.encKey = deriveKey(password, this.userSalt);
  }

  async verifyMasterPassword(password) {
    const hash = await this.hash(password);
    const valid = hash === localStorage.getItem('masterPassword');
    if (valid) {
      this.userSalt = localStorage.getItem('encryptionSalt');
      if (!this.userSalt) {
        const snap = await getDocs(collection(this.db, 'users', this.uid, 'passwords'));
        if (!snap.empty) {
          this.userSalt = snap.docs[0].data().salt;
        } else {
          this.userSalt = nodeCrypto.randomBytes(16).toString('hex');
        }
        localStorage.setItem('encryptionSalt', this.userSalt);
      }
      this.encKey = deriveKey(password, this.userSalt);
    }
    return valid;
  }

  lockVault() {
    this.isVaultUnlocked = false;
    document.querySelector('[data-tab="generator"]').click();
    this.showToast('Vault locked', 'warning');
  }

  setupEventListeners() {
    // Tab navigation with vault locking
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (tab.dataset.tab === 'vault' && !this.isVaultUnlocked) {
          if (!this.isMasterPasswordSet()) {
            this.openModal('setupMasterModal');
          } else {
            this.openModal('unlockMasterModal');
          }
          return;
        }

        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const tabId = tab.dataset.tab;
        document.getElementById(tabId).classList.add('active');
      });
    });

    // Length slider
    const lengthSlider = document.getElementById('lengthSlider');
    const lengthValue = document.getElementById('lengthValue');
    lengthSlider.addEventListener('input', () => {
      lengthValue.textContent = lengthSlider.value;
    });

    // Generate button
    document.getElementById('generateBtn').addEventListener('click', () => {
      const password = this.generatePassword();
      if (password) {
        document.getElementById('passwordDisplay').value = password;
        const strength = this.calculateStrength(password);
        document.getElementById('strengthValue').textContent = strength.text;
        document.querySelector('.strength-meter-bar').style.width = strength.score + '%';
        document.querySelector('.strength-meter-bar').style.backgroundPosition = `${100 - strength.score}% 0`;
      }
    });

    // Copy button
    document.getElementById('copyBtn').addEventListener('click', () => {
      const passwordDisplay = document.getElementById('passwordDisplay');
      if (passwordDisplay.value) {
        navigator.clipboard.writeText(passwordDisplay.value);
        this.showToast('Password copied to clipboard', 'success');
      }
    });

    // Save button
    document.getElementById('saveBtn').addEventListener('click', () => {
      const password = document.getElementById('passwordDisplay').value;
      if (password) {
        document.getElementById('passwordToSave').value = password;
        this.openModal('saveModal');
      } else {
        this.showToast('Generate a password first', 'error');
      }
    });

    // Add password button
    document.getElementById('addPasswordBtn').addEventListener('click', () => {
      document.getElementById('passwordToSave').value = '';
      this.openModal('saveModal');
    });

    // Lock vault button
    document.getElementById('lockVaultBtn').addEventListener('click', () => {
      this.lockVault();
    });

    // Save form
    document.getElementById('saveForm').addEventListener('submit', (e) => {
      e.preventDefault();

      const data = {
        siteName: document.getElementById('siteName').value,
        username: document.getElementById('username').value,
        password: document.getElementById('passwordToSave').value,
        notes: document.getElementById('notes').value
      };

      if (this.editingId) {
        this.updatePassword(this.editingId, data);
        this.showToast('Password updated', 'success');
      } else {
        this.addPassword(data);
        this.showToast('Password saved', 'success');
      }

      this.closeModal('saveModal');
      document.getElementById('saveForm').reset();

      // Switch to vault tab
      document.querySelector('[data-tab="vault"]').click();
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
      const results = this.searchPasswords(e.target.value);
      this.renderPasswords(results);
    });

    // Master password setup
    document.getElementById('setupMasterForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pass = document.getElementById('masterPassword').value;
      const confirm = document.getElementById('masterPasswordConfirm').value;
      if (pass !== confirm) {
        this.showToast('Passwords do not match', 'error');
        return;
      }
      await this.setMasterPassword(pass);
      this.isVaultUnlocked = true;
      this.closeModal('setupMasterModal');
      document.getElementById('setupMasterForm').reset();
      this.passwords = await this.loadPasswords();
      this.renderPasswords();
      this.updateEmptyState();
      document.querySelector('[data-tab="vault"]').click();
      this.showToast('Master password set', 'success');
    });

    // Master password unlock
    document.getElementById('unlockMasterForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pass = document.getElementById('masterPasswordInput').value;
      const valid = await this.verifyMasterPassword(pass);
      if (valid) {
        this.isVaultUnlocked = true;
        this.closeModal('unlockMasterModal');
        document.getElementById('unlockMasterForm').reset();
        this.passwords = await this.loadPasswords();
        this.renderPasswords();
        this.updateEmptyState();
        document.querySelector('[data-tab="vault"]').click();
        this.showToast('Vault unlocked', 'success');
      } else {
        this.showToast('Incorrect master password', 'error');
      }
    });

    // Modal controls
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        this.closeModal(modalId);
      });
    });

    // Close modal on background click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });
  }

  openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  }

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    this.editingId = null;
  }
}

// Initialize the app
const app = new PasswordManager();

