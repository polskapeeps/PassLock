// DOM Elements
const passwordDisplay = document.getElementById('passwordDisplay');
const copyButton = document.getElementById('copyButton');
const lengthSlider = document.getElementById('lengthSlider');
const lengthValueSpan = document.getElementById('lengthValue');

// New Toggle Buttons for character types
const toggleUppercaseBtn = document.getElementById('toggleUppercase');
const toggleLowercaseBtn = document.getElementById('toggleLowercase');
const toggleNumbersBtn = document.getElementById('toggleNumbers');
const toggleSymbolsBtn = document.getElementById('toggleSymbols');

// Settings Panel Elements
const settingsButton = document.getElementById('settingsButton');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettingsButton = document.getElementById('closeSettingsButton');
const excludeCharsInput = document.getElementById('excludeChars'); // Renamed for clarity
const avoidAmbiguousCheckbox = document.getElementById('avoidAmbiguous'); // Renamed for clarity
const requireAllTypesCheckbox = document.getElementById('requireAllTypes'); // Renamed for clarity

const generateButton = document.getElementById('generateButton');
const copyMessage = document.getElementById('copyMessage');
const errorMessage = document.getElementById('error-message');
const strengthMeterBar = document.querySelector('.strength-meter-bar');
const strengthText = document.getElementById('strength-text');

const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
const numberChars = '0123456789';
const symbolChars = '!@#$%^&*()_+[]{}|;:,.<>?';
const ambiguousCharsDefault = '0O1Il|';

// --- Initialization ---
function initializeApp() {
  updateLengthValue(); // Set initial length value

  // Set default active states for char type buttons (already in HTML, but good for JS control too)
  // toggleUppercaseBtn.classList.add("active");
  // toggleLowercaseBtn.classList.add("active");
  // toggleNumbersBtn.classList.add("active");
  // toggleSymbolsBtn.classList.remove("active"); // Default off

  // Set default states for settings (already in HTML, but good for JS control too)
  // avoidAmbiguousCheckbox.checked = true;
  // requireAllTypesCheckbox.checked = true;

  generatePassword(); // Generate a password on load
}

// --- Improved random char gen ---
function getSecureRandomChar(characterString) {
  if (!characterString || characterString.length === 0) return ''; // Handle empty string
  const randomBuffer = new Uint32Array(1);
  window.crypto.getRandomValues(randomBuffer);
  const randomIndex = randomBuffer[0] % characterString.length;
  return characterString[randomIndex];
}

// --- Password Strength Calculation (Simplified for brevity, use your existing robust one) ---
function calculatePasswordStrength(password) {
  let score = 0;
  if (!password) return { score: 0, text: 'Very Weak' };

  // Length
  score += Math.min(2, Math.floor(password.length / 4)) * 10; // Max 20 for length up to 8

  // Variety
  let variety = 0;
  if (/[a-z]/.test(password)) variety++;
  if (/[A-Z]/.test(password)) variety++;
  if (/\d/.test(password)) variety++;
  if (/[^a-zA-Z0-9]/.test(password)) variety++;

  score += Math.min(variety, 4) * 10; // Max 40 for variety

  // Bonus for longer passwords with more variety
  if (password.length > 8 && variety >= 3) score += 10;
  if (password.length > 12 && variety >= 4) score += 10;
  if (password.length > 16) score += 10;

  score = Math.min(100, score); // Cap at 100

  let strengthLabel = 'Very Weak';
  if (score >= 80) strengthLabel = 'Very Strong';
  else if (score >= 60) strengthLabel = 'Strong';
  else if (score >= 40) strengthLabel = 'Medium';
  else if (score >= 20) strengthLabel = 'Weak';

  return { score, text: strengthLabel };
}

// Update the strength meter
function updatePasswordStrength(password) {
  const strength = calculatePasswordStrength(password);

  strengthMeterBar.style.width = strength.score + '%';
  strengthText.textContent = 'Strength: ' + strength.text;

  if (strength.score < 20)
    strengthMeterBar.style.backgroundColor = 'var(--error-color)'; // Red
  else if (strength.score < 40)
    strengthMeterBar.style.backgroundColor = '#ffdd57'; // Yellow
  else if (strength.score < 60)
    strengthMeterBar.style.backgroundColor = '#ffaa00'; // Orange
  else if (strength.score < 80)
    strengthMeterBar.style.backgroundColor = 'var(--success-color)'; // Green
  else strengthMeterBar.style.backgroundColor = '#007aff'; // Blue for Very Strong
}

// --- Password Generation ---
function generatePassword() {
  copyMessage.classList.remove('show');
  errorMessage.textContent = ''; // Clear previous errors

  const length = parseInt(lengthSlider.value);
  const includeUppercase = toggleUppercaseBtn.classList.contains('active');
  const includeLowercase = toggleLowercaseBtn.classList.contains('active');
  const includeNumbers = toggleNumbersBtn.classList.contains('active');
  const includeSymbols = toggleSymbolsBtn.classList.contains('active');

  const excludedCharsValue = excludeCharsInput.value;
  const shouldAvoidAmbiguous = avoidAmbiguousCheckbox.checked;
  const shouldRequireAllTypes = requireAllTypesCheckbox.checked;

  let charPool = '';
  let tempUppercaseChars = uppercaseChars;
  let tempLowercaseChars = lowercaseChars;
  let tempNumberChars = numberChars;
  let tempSymbolChars = symbolChars;

  let allExclusions = excludedCharsValue;
  if (shouldAvoidAmbiguous) {
    allExclusions += ambiguousCharsDefault;
  }

  // Filter out excluded characters from each set
  if (allExclusions) {
    const exclusionRegex = new RegExp(
      `[${allExclusions.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`,
      'g'
    );
    tempUppercaseChars = tempUppercaseChars.replace(exclusionRegex, '');
    tempLowercaseChars = tempLowercaseChars.replace(exclusionRegex, '');
    tempNumberChars = tempNumberChars.replace(exclusionRegex, '');
    tempSymbolChars = tempSymbolChars.replace(exclusionRegex, '');
  }

  let password = '';
  const selectedTypes = [];

  if (includeUppercase && tempUppercaseChars) {
    charPool += tempUppercaseChars;
    if (shouldRequireAllTypes) selectedTypes.push(tempUppercaseChars);
  }
  if (includeLowercase && tempLowercaseChars) {
    charPool += tempLowercaseChars;
    if (shouldRequireAllTypes) selectedTypes.push(tempLowercaseChars);
  }
  if (includeNumbers && tempNumberChars) {
    charPool += tempNumberChars;
    if (shouldRequireAllTypes) selectedTypes.push(tempNumberChars);
  }
  if (includeSymbols && tempSymbolChars) {
    charPool += tempSymbolChars;
    if (shouldRequireAllTypes) selectedTypes.push(tempSymbolChars);
  }

  if (!charPool) {
    errorMessage.textContent =
      'Please select at least one character type or check exclusions.';
    passwordDisplay.value = '';
    updatePasswordStrength('');
    return;
  }

  if (shouldRequireAllTypes) {
    if (length < selectedTypes.length) {
      errorMessage.textContent = `Length must be at least ${selectedTypes.length} to include all selected types.`;
      passwordDisplay.value = '';
      updatePasswordStrength('');
      return;
    }

    // Add one character from each required type
    selectedTypes.forEach((typeSet) => {
      if (typeSet) password += getSecureRandomChar(typeSet);
    });

    // Fill remaining length
    for (let i = password.length; i < length; i++) {
      password += getSecureRandomChar(charPool);
    }
    password = shuffleString(password); // Shuffle to mix required chars
  } else {
    for (let i = 0; i < length; i++) {
      password += getSecureRandomChar(charPool);
    }
  }

  passwordDisplay.value = password;
  updatePasswordStrength(password);
}

// Helper function to shuffle a string
function shuffleString(string) {
  const array = string.split('');
  for (let i = array.length - 1; i > 0; i--) {
    const randomBuffer = new Uint32Array(1);
    window.crypto.getRandomValues(randomBuffer);
    const j = randomBuffer[0] % (i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array.join('');
}

function updateLengthValue() {
  lengthValueSpan.textContent = lengthSlider.value;
  generatePassword(); // Regenerate password when length changes
}

function copyToClipboard() {
  if (passwordDisplay.value) {
    navigator.clipboard
      .writeText(passwordDisplay.value)
      .then(() => {
        copyMessage.classList.add('show');
        setTimeout(() => {
          copyMessage.classList.remove('show');
        }, 2000); // Message disappears after 2 seconds
      })
      .catch((err) => {
        console.error('Failed to copy: ', err);
        errorMessage.textContent = 'Failed to copy password.';
      });
  }
}

// --- Event Listeners ---
generateButton.addEventListener('click', generatePassword);
lengthSlider.addEventListener('input', updateLengthValue);
copyButton.addEventListener('click', copyToClipboard);

// Character Type Toggle Button Listeners
[
  toggleUppercaseBtn,
  toggleLowercaseBtn,
  toggleNumbersBtn,
  toggleSymbolsBtn,
].forEach((btn) => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    generatePassword();
  });
});

// Settings Panel Listeners
settingsButton.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
});

closeSettingsButton.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
  generatePassword(); // Regenerate if settings were changed
});

// Regenerate password if settings inside panel change
[excludeCharsInput, avoidAmbiguousCheckbox, requireAllTypesCheckbox].forEach(
  (input) => {
    input.addEventListener('change', generatePassword);
  }
);
excludeCharsInput.addEventListener('input', generatePassword); // For real-time update on typing

// --- Initialize ---
initializeApp();
