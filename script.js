// DOM Elements
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

// --- Character Sets ---
const uppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const lowercaseChars = "abcdefghijklmnopqrstuvwxyz";
const numberChars = "0123456789";
const symbolChars = "!@#$%^&*()_+[]{}|;:,.<>?";

// --- Improved random char gen ---
function getSecureRandomChar(characterString) {
  const randomBuffer = new Uint32Array(1);
  window.crypto.getRandomValues(randomBuffer);
  const randomIndex = randomBuffer[0] % characterString.length;
  return characterString[randomIndex];
}

// --- Password Strength --
function calculatePasswordStrength(password) {
  let score = 0;

  if (password.length < 1) return { score: 0, text: "Too Short" };

  score += Math.min(40, password.length * 2);

  // Check character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  // Points for variety
  const charVariety = [hasLower, hasUpper, hasNumber, hasSymbol]
    .filter(Boolean).length;
  score += charVariety * 10;

  // Points for good distribution of character types
  const lowerRatio = password.replace(/[^a-z]/g, '').length / password.length;
  const upperRatio = password.replace(/[^A-Z]/g, '').length / password.length;
  const numberRatio = password.replace(/[^\d]/g, '').length / password.length;
  const symbolRatio = password.replace(/[a-zA-Z0-9]/g, '').length / password.length;

  // Calculate distribution score -- closer to even better --
  const idealRatio = 1 / Math.max(1, charVariety);
  const ratioScore = 20 * (1 - Math.max(
    Math.abs(lowerRatio - idealRatio),
    Math.abs(upperRatio - idealRatio),
    Math.abs(numberRatio - idealRatio),
    Math.abs(symbolRatio - idealRatio)
  ) / idealRatio);

  score += ratioScore;

  //  Determine strength category
  let strengthText = '';
  if (score < 20) strengthText = 'Very Weak';
  else if (score < 40) strengthText = 'Weak';
  else if (score < 60) strengthText = 'Medium';
  else if (score < 80) strengthText = 'Strong';
  else strengthText = 'Very Strong';

  return {
    score: Math.min(100, Math.floor(score)),
    text: strengthText
  };
}

// update the strength meter
function updatePasswordStrength(password) {
  const strength = calculatePasswordStrength(password);

  strengthMeterBar.style.width = strength.score + "%";
  strengthText.textContent = 'Strength: ' + strength.text;

  // Update color based on strength
  if (strength.score < 20) {
    strengthMeterBar.style.backgroundColor = '#ff3860'; // Red
  } else if (strength.score < 40) {
    strengthMeterBar.style.backgroundColor = '#ffdd57'; // Yellow
  } else if (strength.score < 60) {
    strengthMeterBar.style.backgroundColor = '#ffaa00'; // Orange
  } else if (strength.score < 80) {
    strengthMeterBar.style.backgroundColor = '#09c372'; // Green
  } else {
    strengthMeterBar.style.backgroundColor = '#007aff'; // Blue
  }
}

// --- Password Generation ---
function generatePassword() {
  const length = parseInt(lengthSlider.value);
  const uppercase = includeUppercase.checked;
  const lowercase = includeLowercase.checked;
  const numbers = includeNumbers.checked;
  const symbols = includeSymbols.checked;
  const excludedChars = excludeChars.value;
  const shouldAvoidAmbiguous = avoidAmbiguous.checked;
  const shouldRequireAllTypes = requireAllTypes.checked;
  const ambiguousChars = "0O1Il|";   // remove or make standard eventually

  if (shouldRequireAllTypes) {
    const requiredCount = [uppercase, lowercase, numbers, symbols]
      .filter(Boolean).length;
    if (length < requiredCount) {
      errorMessage.textContent =
        `Length must be at least ${requiredCount} to include all selected types.`;
      passwordDisplay.value = ''; // Clear display
      updatePasswordStrength(''); // Reset strength meter
      return;
    }
  }

  let allowedChars = "";
  let uppercaseSet = uppercaseChars;
  let lowercaseSet = lowercaseChars;
  let numberSet = numberChars;
  let symbolSet = symbolChars;

  if (excludedChars || shouldAvoidAmbiguous) {
    const exclusions = shouldAvoidAmbiguous
      ? excludedChars + ambiguousChars
      : excludedChars;

    for (const char of exclusions) {
      uppercaseSet = uppercaseSet.replace(char, "");
      lowercaseSet = lowercaseSet.replace(char, "");
      numberSet = numberSet.replace(char, "");
      symbolSet = symbolSet.replace(char, "");
    }
  }

  // Add selected character sets to allowed characters
  if (uppercase) allowedChars += uppercaseSet;
  if (lowercase) allowedChars += lowercaseSet;
  if (numbers) allowedChars += numberSet;
  if (symbols) allowedChars += symbolSet;

  // Validate character set selection
  if (!allowedChars) {
    errorMessage.textContent = "Please select at least one character type.";
    return;
  } else {
    errorMessage.textContent = "";
  }

  // Generate the password
  let password = "";

  if (shouldRequireAllTypes) {
    const requiredChars = [];

    if (uppercase && uppercaseSet.length > 0)
      requiredChars.push(getSecureRandomChar(uppercaseSet));

    if (lowercase && lowercaseSet.length > 0)
      requiredChars.push(getSecureRandomChar(lowercaseSet));

    if (numbers && numberSet.length > 0)
      requiredChars.push(getSecureRandomChar(numberSet));

    if (symbols && symbolSet.length > 0)
      requiredChars.push(getSecureRandomChar(symbolSet));

    // Add required characters
    password = requiredChars.join('');

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += getSecureRandomChar(allowedChars);
    }

    // Shuffle the password to randomize positions of required characters
    password = shuffleString(password);
  } else {
    // Standard random generation
    for (let i = 0; i < length; i++) {
      password += getSecureRandomChar(allowedChars);
    }
  }

  // Update UI with new password
  passwordDisplay.value = password;
  updatePasswordStrength(password);
}

// Helper function to shuffle a string
function shuffleString(string) {
  const array = string.split('');

  // Fisher-Yates shuffle algorithm
  for (let i = array.length - 1; i > 0; i--) {
    const randomBuffer = new Uint32Array(1);
    window.crypto.getRandomValues(randomBuffer);
    const j = randomBuffer[0] % (i + 1);
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }

  return array.join('');
}

function updateLengthValue() {
  lengthValueSpan.textContent = lengthSlider.value;
}

function copyToClipboard() {
  if (passwordDisplay.value) {
    navigator.clipboard.writeText(passwordDisplay.value);
    copyMessage.classList.add("show");
    setTimeout(() => {
      copyMessage.classList.remove("show");
    }, 3000); // Message disappears after 3 seconds
  }
}

// --- Event Listeners ---
generateButton.addEventListener("click", generatePassword);
lengthSlider.addEventListener("input", updateLengthValue);
copyButton.addEventListener("click", copyToClipboard);

// --- Initialization ---
updateLengthValue(); // Set initial length value