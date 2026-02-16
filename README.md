# PassLock

PassLock is a desktop application for generating secure passwords with customizable options. It is built with Electron and keeps the original frameless rounded/oval-style desktop UI.

## Features

- Generates passwords with a user-defined length (4-28 characters).
- Character controls:
  - Uppercase letters (A-Z)
  - Lowercase letters (a-z)
  - Numbers (0-9)
  - Symbols (!@#$%^&*)
- Exclude specific characters.
- Avoid ambiguous characters (e.g., 0, O, 1, I, l).
- Require at least one character from each selected type.
- Real-time password strength indicator.
- One-click copy-to-clipboard.
- **Local saved password vault** with account label + optional username.
- Saved vault entries can be copied or deleted.
- Uses Electron `safeStorage` OS encryption when available.
- Runs as a tray application for quick access.

## Security Review (Current State)

### Improvements made in this update

- Added a secure bridge (`preload.js`) and IPC handlers so the renderer never gets direct Node.js APIs.
- Added vault persistence in the main process only.
- Added encryption for saved passwords using `safeStorage` where supported by the OS.
- Added UI warnings when OS-level encryption is not available.

### Remaining suggestions

- Add a strict Content Security Policy and host local icon/font assets instead of remote CDNs.
- Add auto-clear clipboard after a timer (optional security mode).
- Add export/import with a user master password (encrypted backup).
- Add search/filter in vault entries when the list grows.
- Add unit tests for password generation and IPC vault validation.

## Technologies Used

- HTML
- CSS
- JavaScript
- Electron
- Node.js

## Getting Started

### Prerequisites

- Node.js and npm installed. Download from [nodejs.org](https://nodejs.org/).

### Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/polskapeeps/PassLock.git
   ```
2. Navigate to the project directory:
   ```bash
   cd PassLock
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   npm start
   ```

### Building for Distribution

The application can be packaged for Windows and macOS using Electron Builder.

- **To build for Windows:**
  ```bash
  npm run dist:win
  ```
- **To build for macOS:**
  ```bash
  npm run dist:mac
  ```

Distributable files will be generated in the `dist/` directory.

## Project Structure

```text
PassLock/
├── src/
│   ├── app/
│   │   ├── main.js         # Main Electron process + vault handlers
│   │   ├── preload.js      # Secure renderer <-> main bridge
│   │   └── tray.js         # System tray icon and context menu logic
│   └── renderer/
│       ├── index.html      # Main UI
│       ├── script.js       # Password generation + vault UI logic
│       └── style.css       # Styling
├── assets/
├── package.json
└── README.md
```

## License

This project is licensed under the MIT License. See the [repository](https://github.com/polskapeeps/PassLock) for more details.
