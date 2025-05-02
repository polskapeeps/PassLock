// =====================================================================
// DOM Elements
// =====================================================================
const passwordDisplay = document.getElementById("passwordDisplay");
const copyButton = document.getElementById("copyButton");
const lengthSlider = document.getElementById("lengthSlider");
const lengthValueSpan = document.getElementById("lengthValue");
const includeUppercase = document.getElementById("includeUppercase");
const includeLowercase = document.getElementById("includeLowercase");
const includeNumbers = document.getElementById("includeNumbers");
const includeSymbols = document.getElementById("includeSymbols");
const excludeChars = document.getElementById("excludeChars");
const avoidAmbiguous = document.getElementById("avoidAmbiguous");
const requireAllTypes = document.getElementById("requireAllTypes");
const generateButton = document.getElementById("generateButton");
const copyMessage = document.getElementById("copyMessage");
const errorMessage = document.getElementById("error-message");
const strengthMeter = document.getElementById("strength-meter");
const strengthMeterBar = document.querySelector(".strength-meter-bar");
const strengthText = document.getElementById("strength-text");
// History Elements
const passwordHistorySelect = document.getElementById("passwordHistory");
const copyHistoryButton = document.getElementById("copyHistoryButton");
const copyHistoryMessage = document.getElementById("copyHistoryMessage");


// =====================================================================
// Character Sets
// =====================================================================
const uppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const lowercaseChars = "abcdefghijklmnopqrstuvwxyz";
const numberChars = "0123456789";
const symbolChars = "!@#$%^&*()_+[]{}|;:,.<>?"; // Consider adding more symbols if desired
const ambiguousChars = "0O1Il|";


// =====================================================================
// State Variables
// =====================================================================
let passwordHistory = []; // Stores the last N passwords generated in this session
const MAX_HISTORY = 5;    // Max number of passwords to keep in history


// =====================================================================
// Core Functions
// =====================================================================

/**
 * Generates a cryptographically secure random character from a given string.
 * @param {string} characterString - The string to pick a character from.
 * @returns {string} A single random character.
 */
function getSecureRandomChar(characterString) {
  if (!characterString || characterString.length === 0) {
    console.error("Cannot get random char from empty string");
    return ''; // Return empty if the source string is empty
  }
  const randomBuffer = new Uint32Array(1);
  window.crypto.getRandomValues(randomBuffer);
  const randomIndex = randomBuffer[0] % characterString.length;
  return characterString[randomIndex];
}

/**
 * Shuffles the characters in a string using the Fisher-Yates algorithm.
 * @param {string} string - The string to shuffle.
 * @returns {string} The shuffled string.
 */
function shuffleString(string) {
  const array = string.split('');
  for (let i = array.length - 1; i > 0; i--) {
    const randomBuffer = new Uint32Array(1);
    window.crypto.getRandomValues(randomBuffer);
    const j = randomBuffer[0] % (i + 1);
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array.join('');
}

/**
 * Calculates a basic password strength score and category.
 * NOTE: For more robust analysis, consider integrating a library like zxcvbn.
 * @param {string} password - The password to analyze.
 * @returns {{score: number, text: string}} An object with the score (0-100) and text description.
 */
function calculatePasswordStrength(password) {
  let score = 0;
  if (!password || password.length < 1) return { score: 0, text: "Very Weak" };

  // Length points (max 40)
  score += Math.min(40, password.length * 2.5); // Adjusted multiplier

  // Character variety points
  const checks = {
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) // Escaped special regex chars
  };
  const varietyCount = Object.values(checks).filter(Boolean).length;
  score += varietyCount * 10; // Add points for each type present

  // Bonus for having multiple types
  if (varietyCount >= 3 && password.length >= 8) score += 10;
  if (varietyCount === 4 && password.length >= 12) score += 10;

  // Simple entropy estimation (very basic)
  let poolSize = 0;
  if (checks.lower) poolSize += 26;
  if (checks.upper) poolSize += 26;
  if (checks.number) poolSize += 10;
  if (checks.symbol) poolSize += symbolChars.length; // Use actual symbol count
  if (poolSize > 0) {
      const entropy = password.length * Math.log2(poolSize);
      score += Math.min(20, entropy / 3); // Add entropy-based points (capped)
  }

  // Determine strength category based on score
  let strengthText = '';
  const finalScore = Math.min(100, Math.max(0, Math.floor(score))); // Clamp score 0-100

  if (finalScore < 25) strengthText = 'Very Weak';
  else if (finalScore < 45) strengthText = 'Weak';
  else if (finalScore < 65) strengthText = 'Medium';
  else if (finalScore < 85) strengthText = 'Strong';
  else strengthText = 'Very Strong';

  return { score: finalScore, text: strengthText };
}

/**
 * Main function to generate the password based on current settings.
 */
function generatePassword() {
  // Clear previous messages
  errorMessage.textContent = "";
  copyMessage.classList.remove("show");
  copyHistoryMessage.classList.remove("show");

  // Get current settings from the UI
  const length = parseInt(lengthSlider.value);
  const uppercase = includeUppercase.checked;
  const lowercase = includeLowercase.checked;
  const numbers = includeNumbers.checked;
  const symbols = includeSymbols.checked;
  const excludedInput = excludeChars.value;
  const shouldAvoidAmbiguous = avoidAmbiguous.checked;
  const shouldRequireAllTypes = requireAllTypes.checked;

  // Build the final exclusion list
  let finalExcludedChars = excludedInput;
  if (shouldAvoidAmbiguous) {
    finalExcludedChars += ambiguousChars;
  }

  // Filter character sets based on exclusions
  const filterSet = (set) => {
    if (!finalExcludedChars) return set;
    return set.split('').filter(char => !finalExcludedChars.includes(char)).join('');
  };

  const availableSets = {
    upper: uppercase ? filterSet(uppercaseChars) : '',
    lower: lowercase ? filterSet(lowercaseChars) : '',
    number: numbers ? filterSet(numberChars) : '',
    symbol: symbols ? filterSet(symbolChars) : ''
  };

  // Combine all available characters into one pool
  let allowedChars = Object.values(availableSets).join('');

  // --- Validations ---
  if (!allowedChars) {
    errorMessage.textContent = "No characters available. Please select types or adjust exclusions.";
    passwordDisplay.value = '';
    updatePasswordStrength('');
    return;
  }

  const selectedTypesCount = Object.values(availableSets).filter(set => set.length > 0).length;

  if (shouldRequireAllTypes && length < selectedTypesCount) {
    errorMessage.textContent = `Length must be at least ${selectedTypesCount} to include all selected types.`;
    passwordDisplay.value = '';
    updatePasswordStrength('');
    return;
  }

  // --- Generation Logic ---
  let password = "";
  let requiredChars = [];

  if (shouldRequireAllTypes) {
    // Ensure at least one character from each selected *available* set
    if (availableSets.upper) requiredChars.push(getSecureRandomChar(availableSets.upper));
    if (availableSets.lower) requiredChars.push(getSecureRandomChar(availableSets.lower));
    if (availableSets.number) requiredChars.push(getSecureRandomChar(availableSets.number));
    if (availableSets.symbol) requiredChars.push(getSecureRandomChar(availableSets.symbol));

    // Add required characters first
    password = requiredChars.join('');
  }

  // Fill the remaining length with random characters from the allowed pool
  const remainingLength = length - password.length;
  for (let i = 0; i < remainingLength; i++) {
    password += getSecureRandomChar(allowedChars);
  }

  // Shuffle the final password thoroughly if requirements were enforced
  if (shouldRequireAllTypes) {
    password = shuffleString(password);
  }

  // --- Update UI and History ---
  passwordDisplay.value = password;
  updatePasswordStrength(password);

  // Add to history (only if password generation was successful)
  if (password) {
      passwordHistory.unshift(password); // Add to the beginning
      if (passwordHistory.length > MAX_HISTORY) {
          passwordHistory.pop(); // Remove the oldest if > MAX_HISTORY
      }
      updateHistoryDropdown();
  }
}


// =====================================================================
// UI Update Functions
// =====================================================================

/**
 * Updates the displayed password length value and the slider background.
 */
function updateLengthValue() {
  lengthValueSpan.textContent = lengthSlider.value;
  updateSliderBackground(); // Update gradient fill
}

/**
 * Updates the background gradient of the length slider based on its value.
 */
function updateSliderBackground() {
  const min = lengthSlider.min;
  const max = lengthSlider.max;
  const val = lengthSlider.value;
  // Calculate percentage, ensuring min/max are numbers and max > min
  const numericMin = Number(min);
  const numericMax = Number(max);
  const numericVal = Number(val);
  let percentage = 0;
  if (!isNaN(numericMin) && !isNaN(numericMax) && numericMax > numericMin) {
      percentage = ((numericVal - numericMin) * 100) / (numericMax - numericMin);
  }
  lengthSlider.style.background = `linear-gradient(90deg, var(--primary-color) ${percentage}%, var(--slider-track) ${percentage}%)`;
}


/**
 * Updates the strength meter bar width and text description.
 * @param {string} password - The password being evaluated.
 */
function updatePasswordStrength(password) {
  const strength = calculatePasswordStrength(password);

  strengthMeterBar.style.width = strength.score + "%";
  strengthText.textContent = 'Strength: ' + strength.text;

  // Update color based on strength score
  let barColor = 'var(--error-color)'; // Default red (Very Weak)
  if (strength.score >= 85) barColor = 'var(--success-color)'; // Strongest (Green)
  else if (strength.score >= 65) barColor = '#4CAF50'; // Strong (Slightly different green)
  else if (strength.score >= 45) barColor = '#ffc107'; // Medium (Yellow/Orange)
  else if (strength.score >= 25) barColor = '#ff9800'; // Weak (Orange)

  strengthMeterBar.style.backgroundColor = barColor;
}

/**
 * Copies the currently displayed password to the clipboard and shows feedback.
 */
function copyToClipboard() {
  const currentPassword = passwordDisplay.value;
  if (currentPassword) {
    navigator.clipboard.writeText(currentPassword).then(() => {
      copyMessage.textContent = "Copied!"; // Set text before showing
      copyMessage.classList.add("show");
      copyHistoryMessage.classList.remove("show"); // Hide other message
      setTimeout(() => {
        copyMessage.classList.remove("show");
      }, 2000); // Message disappears after 2 seconds
    }).catch(err => {
      console.error('Failed to copy password: ', err);
      errorMessage.textContent = "Failed to copy to clipboard.";
    });

    // Example of using preload API (if you set it up in main.js/preload.js)
    // if (window.electronAPI && window.electronAPI.copyText) {
    //   window.electronAPI.copyText(currentPassword);
    //   console.log("Requested copy via preload API");
    //   // Handle confirmation via IPC if needed
    // } else {
    //   console.warn("Preload API (electronAPI.copyText) not available.");
    // }
  }
}

/**
 * Populates the history dropdown with passwords from the passwordHistory array.
 */
function updateHistoryDropdown() {
    passwordHistorySelect.innerHTML = ''; // Clear existing options

    if (passwordHistory.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "-- No history yet --";
        passwordHistorySelect.appendChild(option);
        copyHistoryButton.disabled = true; // Disable copy button if no history
    } else {
        passwordHistory.forEach((pwd) => { // No index needed here
            const option = document.createElement('option');
            option.value = pwd;
            option.textContent = pwd; // Display the password itself
            passwordHistorySelect.appendChild(option);
        });
        copyHistoryButton.disabled = false; // Enable copy button
    }
}

/**
 * Copies the selected password from the history dropdown to the clipboard.
 */
function copySelectedHistory() {
    const selectedPassword = passwordHistorySelect.value;
    if (selectedPassword) {
        navigator.clipboard.writeText(selectedPassword).then(() => {
            copyHistoryMessage.textContent = 'History Copied!';
            copyHistoryMessage.classList.add("show");
            copyMessage.classList.remove("show"); // Hide other message
             setTimeout(() => {
                copyHistoryMessage.classList.remove("show");
             }, 2000); // Hide after 2 seconds
        }).catch(err => {
            console.error('Failed to copy history password: ', err);
            errorMessage.textContent = "Failed to copy history.";
        });
    }
}


// =====================================================================
// Event Listeners
// =====================================================================
generateButton.addEventListener("click", generatePassword);
lengthSlider.addEventListener("input", updateLengthValue);
copyButton.addEventListener("click", copyToClipboard);
copyHistoryButton.addEventListener('click', copySelectedHistory);

// Regenerate password if options change (optional, can be intensive)
// const optionInputs = document.querySelectorAll('.options input');
// optionInputs.forEach(input => {
//     input.addEventListener('change', generatePassword);
// });


// =====================================================================
// Initialization
// =====================================================================
updateLengthValue(); // Set initial length display and slider background
updatePasswordStrength(''); // Initialize strength meter display
updateHistoryDropdown(); // Initialize history dropdown
generatePassword(); // Generate an initial password on load

console.log("PassLock Script Initialized");
