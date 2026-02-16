// DOM Elements
const passwordDisplay = document.getElementById('passwordDisplay');
const copyButton = document.getElementById('copyButton');
const lengthSlider = document.getElementById('lengthSlider');
const lengthValueSpan = document.getElementById('lengthValue');
const includeUppercase = document.getElementById('includeUppercase');
const includeLowercase = document.getElementById('includeLowercase');
const includeNumbers = document.getElementById('includeNumbers');
const includeSymbols = document.getElementById('includeSymbols');
const excludeChars = document.getElementById('excludeChars');
const avoidAmbiguous = document.getElementById('avoidAmbiguous');
const requireAllTypes = document.getElementById('requireAllTypes');
const generateButton = document.getElementById('generateButton');
const copyMessage = document.getElementById('copyMessage');
const errorMessage = document.getElementById('error-message');
const strengthMeterBar = document.querySelector('.strength-meter-bar');
const strengthText = document.getElementById('strength-text');
const savePasswordButton = document.getElementById('savePasswordButton');
const vaultLabel = document.getElementById('vaultLabel');
const vaultUsername = document.getElementById('vaultUsername');
const savedPasswords = document.getElementById('savedPasswords');
const vaultSecurityHint = document.getElementById('vaultSecurityHint');

const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
const numberChars = '0123456789';
const symbolChars = '!@#$%^&*()_+[]{}|;:,.<>?';
let copyMessageTimer;
let vaultEntries = [];

function getSecureRandomChar(characterString) {
  const randomBuffer = new Uint32Array(1);
  window.crypto.getRandomValues(randomBuffer);
  const randomIndex = randomBuffer[0] % characterString.length;
  return characterString[randomIndex];
}

function calculatePasswordStrength(password) {
  let score = 0;

  if (password.length < 1) return { score: 0, text: 'Too Short' };

  score += Math.min(40, password.length * 2);

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password);

  const charVariety = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  score += charVariety * 10;

  const lowerRatio = password.replace(/[^a-z]/g, '').length / password.length;
  const upperRatio = password.replace(/[^A-Z]/g, '').length / password.length;
  const numberRatio = password.replace(/[^\d]/g, '').length / password.length;
  const symbolRatio = password.replace(/[a-zA-Z0-9]/g, '').length / password.length;

  const idealRatio = 1 / Math.max(1, charVariety);
  const ratioScore =
    20 *
    (1 -
      Math.max(
        Math.abs(lowerRatio - idealRatio),
        Math.abs(upperRatio - idealRatio),
        Math.abs(numberRatio - idealRatio),
        Math.abs(symbolRatio - idealRatio)
      ) /
        idealRatio);

  score += ratioScore;

  let strengthLabel = '';
  if (score < 20) strengthLabel = 'Very Weak';
  else if (score < 40) strengthLabel = 'Weak';
  else if (score < 60) strengthLabel = 'Medium';
  else if (score < 80) strengthLabel = 'Strong';
  else strengthLabel = 'Very Strong';

  return {
    score: Math.min(100, Math.floor(score)),
    text: strengthLabel,
  };
}

function updatePasswordStrength(password) {
  const strength = calculatePasswordStrength(password);

  strengthMeterBar.style.width = `${strength.score}%`;
  strengthText.textContent = `Strength: ${strength.text}`;

  if (strength.score < 20) {
    strengthMeterBar.style.backgroundColor = '#ff3860';
  } else if (strength.score < 40) {
    strengthMeterBar.style.backgroundColor = '#ffdd57';
  } else if (strength.score < 60) {
    strengthMeterBar.style.backgroundColor = '#ffaa00';
  } else if (strength.score < 80) {
    strengthMeterBar.style.backgroundColor = '#09c372';
  } else {
    strengthMeterBar.style.backgroundColor = '#007aff';
  }
}

function generatePassword() {
  const length = Number.parseInt(lengthSlider.value, 10);
  const uppercase = includeUppercase.checked;
  const lowercase = includeLowercase.checked;
  const numbers = includeNumbers.checked;
  const symbols = includeSymbols.checked;
  const excludedChars = excludeChars.value;
  const shouldAvoidAmbiguous = avoidAmbiguous.checked;
  const shouldRequireAllTypes = requireAllTypes.checked;
  const ambiguousChars = '0O1Il|';

  if (shouldRequireAllTypes) {
    const requiredCount = [uppercase, lowercase, numbers, symbols].filter(Boolean).length;
    if (length < requiredCount) {
      errorMessage.textContent = `Length must be at least ${requiredCount} to include all selected types.`;
      passwordDisplay.value = '';
      updatePasswordStrength('');
      return;
    }
  }

  let allowedChars = '';
  let uppercaseSet = uppercaseChars;
  let lowercaseSet = lowercaseChars;
  let numberSet = numberChars;
  let symbolSet = symbolChars;

  if (excludedChars || shouldAvoidAmbiguous) {
    const exclusions = shouldAvoidAmbiguous ? excludedChars + ambiguousChars : excludedChars;

    for (const char of exclusions) {
      uppercaseSet = uppercaseSet.replace(char, '');
      lowercaseSet = lowercaseSet.replace(char, '');
      numberSet = numberSet.replace(char, '');
      symbolSet = symbolSet.replace(char, '');
    }
  }

  if (uppercase) allowedChars += uppercaseSet;
  if (lowercase) allowedChars += lowercaseSet;
  if (numbers) allowedChars += numberSet;
  if (symbols) allowedChars += symbolSet;

  if (!allowedChars) {
    errorMessage.textContent = 'Please select at least one character type.';
    return;
  }
  errorMessage.textContent = '';

  let password = '';

  if (shouldRequireAllTypes) {
    const requiredChars = [];

    if (uppercase && uppercaseSet.length > 0) requiredChars.push(getSecureRandomChar(uppercaseSet));
    if (lowercase && lowercaseSet.length > 0) requiredChars.push(getSecureRandomChar(lowercaseSet));
    if (numbers && numberSet.length > 0) requiredChars.push(getSecureRandomChar(numberSet));
    if (symbols && symbolSet.length > 0) requiredChars.push(getSecureRandomChar(symbolSet));

    password = requiredChars.join('');

    for (let index = password.length; index < length; index += 1) {
      password += getSecureRandomChar(allowedChars);
    }

    password = shuffleString(password);
  } else {
    for (let index = 0; index < length; index += 1) {
      password += getSecureRandomChar(allowedChars);
    }
  }

  passwordDisplay.value = password;
  updatePasswordStrength(password);
}

function shuffleString(stringValue) {
  const array = stringValue.split('');

  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomBuffer = new Uint32Array(1);
    window.crypto.getRandomValues(randomBuffer);
    const randomIndex = randomBuffer[0] % (index + 1);
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }

  return array.join('');
}

function updateLengthValue() {
  lengthValueSpan.textContent = lengthSlider.value;
}

async function copyToClipboard() {
  if (!passwordDisplay.value) return;

  await navigator.clipboard.writeText(passwordDisplay.value);
  copyMessage.classList.add('show');

  clearTimeout(copyMessageTimer);
  copyMessageTimer = setTimeout(() => {
    copyMessage.classList.remove('show');
  }, 3000);
}

function renderVaultEntries() {
  if (!vaultEntries.length) {
    savedPasswords.innerHTML = '<li class="empty-state">No saved entries yet.</li>';
    return;
  }

  savedPasswords.innerHTML = vaultEntries
    .map(
      (entry) => `
      <li>
        <strong>${escapeHTML(entry.label)}</strong>
        <div class="entry-meta">${escapeHTML(entry.username || 'No username')}</div>
        <div class="entry-password">${escapeHTML(entry.password)}</div>
        <div class="entry-actions">
          <button data-action="copy" data-id="${entry.id}">Copy</button>
          <button data-action="delete" data-id="${entry.id}">Delete</button>
        </div>
      </li>`
    )
    .join('');
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function refreshVaultEntries() {
  if (!window.passlockAPI) {
    vaultSecurityHint.textContent = 'Vault unavailable in this environment.';
    return;
  }

  const response = await window.passlockAPI.listVaultEntries();
  vaultEntries = response.entries || [];

  vaultSecurityHint.textContent = response.usesSystemEncryption
    ? 'Saved entries are protected using OS encryption.'
    : 'OS encryption unavailable. Entries are obfuscated only.';

  renderVaultEntries();
}

async function saveCurrentPassword() {
  const label = vaultLabel.value.trim();
  const username = vaultUsername.value.trim();
  const password = passwordDisplay.value;

  if (!password) {
    errorMessage.textContent = 'Generate a password before saving.';
    return;
  }

  if (!label) {
    errorMessage.textContent = 'Add an account/site name to save this password.';
    return;
  }

  errorMessage.textContent = '';
  const response = await window.passlockAPI.saveVaultEntry({ label, username, password });
  vaultEntries = response.entries || [];
  renderVaultEntries();
  vaultLabel.value = '';
  vaultUsername.value = '';
}

async function onVaultAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;
  const targetEntry = vaultEntries.find((entry) => entry.id === id);
  if (!targetEntry) return;

  if (action === 'copy') {
    await navigator.clipboard.writeText(targetEntry.password);
    copyMessage.textContent = `Copied ${targetEntry.label}`;
    copyMessage.classList.add('show');

    clearTimeout(copyMessageTimer);
    copyMessageTimer = setTimeout(() => {
      copyMessage.textContent = 'Copied to clipboard';
      copyMessage.classList.remove('show');
    }, 3000);

    return;
  }

  if (action === 'delete') {
    const response = await window.passlockAPI.deleteVaultEntry(id);
    vaultEntries = response.entries || [];
    renderVaultEntries();
  }
}

generateButton.addEventListener('click', generatePassword);
lengthSlider.addEventListener('input', updateLengthValue);
copyButton.addEventListener('click', () => {
  copyToClipboard().catch(() => {
    errorMessage.textContent = 'Unable to access clipboard.';
  });
});
savePasswordButton.addEventListener('click', () => {
  saveCurrentPassword().catch(() => {
    errorMessage.textContent = 'Unable to save password entry.';
  });
});
savedPasswords.addEventListener('click', (event) => {
  onVaultAction(event).catch(() => {
    errorMessage.textContent = 'Unable to update saved entries right now.';
  });
});

updateLengthValue();
refreshVaultEntries().catch(() => {
  vaultSecurityHint.textContent = 'Could not load saved entries.';
});
