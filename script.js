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
const strengthMeterBar = document.querySelector(".strength-meter-bar");
const strengthText = document.getElementById("strength-text");

const uppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const lowercaseChars = "abcdefghijklmnopqrstuvwxyz";
const numberChars = "0123456789";
const symbolChars = "!@#$%^&*()_+[]{}|;:,.<>?";

let copyTimeoutId;

// --- Improved random char gen ---
function getSecureRandomChar(characterString) {
  const randomBuffer = new Uint32Array(1);
  window.crypto.getRandomValues(randomBuffer);
  const randomIndex = randomBuffer[0] % characterString.length;
  return characterString[randomIndex];
}

// --- Password Strength --
function calculatePasswordStrength(password) {
  if (!password) {
    return { score: 0, text: "Waiting for input" };
  }

  let score = 0;

  if (password.length < 4) {
    return { score: 10, text: "Very Weak" };
  }

  score += Math.min(40, password.length * 2);

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const charVariety = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean)
    .length;
  score += charVariety * 10;

  const lowerRatio = password.replace(/[^a-z]/g, "").length / password.length;
  const upperRatio = password.replace(/[^A-Z]/g, "").length / password.length;
  const numberRatio = password.replace(/[^\d]/g, "").length / password.length;
  const symbolRatio =
    password.replace(/[a-zA-Z0-9]/g, "").length / password.length;

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

  let strengthText = "";
  if (score < 20) strengthText = "Very Weak";
  else if (score < 40) strengthText = "Weak";
  else if (score < 60) strengthText = "Medium";
  else if (score < 80) strengthText = "Strong";
  else strengthText = "Very Strong";

  return {
    score: Math.min(100, Math.floor(Math.max(0, score))),
    text: strengthText,
  };
}

function updatePasswordStrength(password) {
  const strength = calculatePasswordStrength(password);
  const scoreWidth =
    strength.text === "Waiting for input" ? 0 : Math.max(0, strength.score);

  strengthMeterBar.style.width = scoreWidth + "%";
  strengthText.textContent = "Strength: " + strength.text;

  let gradient = "linear-gradient(90deg, rgba(56, 189, 248, 0.6), rgba(14, 165, 233, 0.8))";

  if (strength.text === "Waiting for input") {
    gradient = "linear-gradient(90deg, rgba(148, 163, 184, 0.35), rgba(148, 163, 184, 0.25))";
  } else if (strength.score < 20) {
    gradient = "linear-gradient(90deg, rgba(239, 68, 68, 0.85), rgba(239, 68, 68, 0.6))";
  } else if (strength.score < 40) {
    gradient = "linear-gradient(90deg, rgba(249, 115, 22, 0.85), rgba(249, 115, 22, 0.6))";
  } else if (strength.score < 60) {
    gradient = "linear-gradient(90deg, rgba(234, 179, 8, 0.9), rgba(250, 204, 21, 0.7))";
  } else if (strength.score < 80) {
    gradient = "linear-gradient(90deg, rgba(34, 197, 94, 0.85), rgba(16, 185, 129, 0.6))";
  } else {
    gradient = "linear-gradient(90deg, rgba(56, 189, 248, 0.85), rgba(14, 165, 233, 0.65))";
  }

  strengthMeterBar.style.background = gradient;
}

function generatePassword() {
  copyMessage.classList.remove("show", "error");
  clearTimeout(copyTimeoutId);

  const length = parseInt(lengthSlider.value, 10);
  const uppercase = includeUppercase.checked;
  const lowercase = includeLowercase.checked;
  const numbers = includeNumbers.checked;
  const symbols = includeSymbols.checked;
  const excludedChars = excludeChars.value;
  const shouldAvoidAmbiguous = avoidAmbiguous.checked;
  const shouldRequireAllTypes = requireAllTypes.checked;
  const ambiguousChars = "0O1Il|";

  if (shouldRequireAllTypes) {
    const requiredCount = [uppercase, lowercase, numbers, symbols]
      .filter(Boolean)
      .length;
    if (length < requiredCount) {
      errorMessage.textContent = `Length must be at least ${requiredCount} to include all selected types.`;
      passwordDisplay.value = "";
      updatePasswordStrength("");
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
      ? new Set((excludedChars + ambiguousChars).split(""))
      : new Set(excludedChars.split(""));

    exclusions.forEach((char) => {
      uppercaseSet = uppercaseSet.replace(char, "");
      lowercaseSet = lowercaseSet.replace(char, "");
      numberSet = numberSet.replace(char, "");
      symbolSet = symbolSet.replace(char, "");
    });
  }

  if (uppercase) allowedChars += uppercaseSet;
  if (lowercase) allowedChars += lowercaseSet;
  if (numbers) allowedChars += numberSet;
  if (symbols) allowedChars += symbolSet;

  if (!allowedChars) {
    errorMessage.textContent = "Please select at least one character type.";
    passwordDisplay.value = "";
    updatePasswordStrength("");
    return;
  }

  errorMessage.textContent = "";

  let password = "";

  if (shouldRequireAllTypes) {
    const requiredChars = [];

    if (uppercase && uppercaseSet.length > 0) {
      requiredChars.push(getSecureRandomChar(uppercaseSet));
    }

    if (lowercase && lowercaseSet.length > 0) {
      requiredChars.push(getSecureRandomChar(lowercaseSet));
    }

    if (numbers && numberSet.length > 0) {
      requiredChars.push(getSecureRandomChar(numberSet));
    }

    if (symbols && symbolSet.length > 0) {
      requiredChars.push(getSecureRandomChar(symbolSet));
    }

    password = requiredChars.join("");

    for (let i = password.length; i < length; i += 1) {
      password += getSecureRandomChar(allowedChars);
    }

    password = shuffleString(password);
  } else {
    for (let i = 0; i < length; i += 1) {
      password += getSecureRandomChar(allowedChars);
    }
  }

  passwordDisplay.value = password;
  updatePasswordStrength(password);
}

function shuffleString(string) {
  const array = string.split("");

  for (let i = array.length - 1; i > 0; i -= 1) {
    const randomBuffer = new Uint32Array(1);
    window.crypto.getRandomValues(randomBuffer);
    const j = randomBuffer[0] % (i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array.join("");
}

function updateLengthValue() {
  lengthValueSpan.textContent = lengthSlider.value;
}

function showCopyFeedback(message, isError = false) {
  if (!copyMessage) return;

  copyMessage.textContent = message;
  copyMessage.classList.toggle("error", Boolean(isError));
  copyMessage.classList.add("show");

  clearTimeout(copyTimeoutId);
  copyTimeoutId = setTimeout(() => {
    copyMessage.classList.remove("show", "error");
  }, 2400);
}

function copyToClipboard() {
  if (!passwordDisplay.value) {
    return;
  }

  if (!navigator.clipboard) {
    showCopyFeedback("Clipboard unavailable", true);
    return;
  }

  navigator.clipboard
    .writeText(passwordDisplay.value)
    .then(() => {
      showCopyFeedback("Copied to clipboard");
    })
    .catch(() => {
      showCopyFeedback("Clipboard blocked", true);
    });
}

// --- Event Listeners ---
generateButton.addEventListener("click", generatePassword);
lengthSlider.addEventListener("input", updateLengthValue);
copyButton.addEventListener("click", copyToClipboard);

// --- Initialization ---
updateLengthValue();
updatePasswordStrength("");
