# PassLock

PassLock is a desktop application for generating secure passwords with customizable options. It is built with Electron and provides a simple interface for creating strong passwords.

## Features

* Generates passwords with a user-defined length (4-28 characters).
* Allows inclusion/exclusion of:
    * Uppercase letters (A-Z)
    * Lowercase letters (a-z)
    * Numbers (0-9)
    * Symbols (!@#$%^&*)
* Option to exclude specific user-defined characters.
* Option to avoid ambiguous characters (e.g., 0, O, 1, I, l).
* Option to require that the generated password includes at least one character from each selected type.
* Displays a real-time password strength indicator.
* Provides a one-click copy-to-clipboard button for the generated password.
* Runs as a tray application for easy access.
* Stores passwords securely with AES-256-GCM encryption.

## Technologies Used

* HTML
* CSS
* JavaScript
* Electron
* Node.js

## Getting Started

### Prerequisites

* Node.js and npm installed. Download from [nodejs.org](https://nodejs.org/).

### Running Locally

1.  Clone the repository:
    ```bash
    git clone [https://github.com/polskapeeps/PassLock.git](https://github.com/polskapeeps/PassLock.git)
    ```
2.  Navigate to the project directory:
    ```bash
    cd PassLock-Electron-DesktopApp
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Start the application:
    ```bash
    npm start
    ```

### Password Storage

PassLock can persist passwords to an encrypted store. Set the `PASSLOCK_MASTER_KEY`
environment variable to a secret string before running the app. The renderer can
interact with the store through the `passwordStore` API exposed on `window`:

```javascript
// Add a password entry
window.passwordStore.add({ service: 'Example', username: 'alice', password: 'secret' });

// Get all stored passwords
window.passwordStore.getAll().then(entries => console.log(entries));

// Remove by id
window.passwordStore.remove(id);
```

The encrypted data file is saved in the Electron `userData` directory
(`app.getPath('userData')`).

### Building for Distribution

The application can be packaged for Windows and macOS using Electron Builder.

* **To build for Windows:**
    ```bash
    npm run dist:win
    ```
* **To build for macOS:**
    ```bash
    npm run dist:mac
    ```
    The distributable files will be located in the `dist/` directory.

## Project Structure

````

PassLock-Electron-DesktopApp/
├── src/
│   ├── app/
│   │   ├── main.js         \# Main Electron process, window creation
│   │   └── tray.js         \# System tray icon and context menu logic
│   └── renderer/
│       ├── index.html      \# Main HTML file for the UI
│       ├── script.js       \# Frontend logic, password generation
│       └── style.css       \# Application styles
├── assets/
│   └── icons/              \# Application icons (e.g., .ico, .png)
├── build/
│   ├── icon.icns           \# macOS application icon
│   └── background.png      \# Background image for macOS DMG installer
├── package.json            \# Project metadata, dependencies, and build scripts
└── README.md               \# This README file

```

## License

This project is licensed under the MIT License. See the [repository](https://github.com/polskapeeps/PassLock) for more details.
```