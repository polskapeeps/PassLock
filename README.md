 # 🔑 *PassLock* 🔑
 ---

###### A minimalistic password generator now paired with a lightweight manager. Built with Tauri for improved security and native performance.

###### Intended as a personal-use project. Feedback is always welcome!
 
---

### 🚀 Whats included

- Adjustable password length (4–28 characters)
- Real-time strength meter with detailed feedback
- Copy-to-clipboard with animated confirmation
- Character type toggles (uppercase, lowercase, numbers, symbols)
- Exclude specific characters or ambiguous ones (`0O1Il|`)
- “Require all selected types” toggle for strict control
- Securely save generated passwords to local encrypted storage
- Tauri-powered desktop app

---

### 🛠 Built With

- **HTML/CSS/JavaScript** (Vanilla)
- **Tauri** for desktop application framework
- FontAwesome for UI icons  
- Google Fonts (Poppins) for styling

---

### 📦 Getting Started

#### 💻 Run as a Web App

No setup required — just open `index.html` in your browser and go!

#### 🦀 Run Tauri App (Desktop)

Make sure you have [Node.js](https://nodejs.org/) and the Rust toolchain installed.

```bash
# Clone the repo
git clone https://github.com/polskapeeps/PassLock

# Navigate to project folder
cd '/path/to/directory/PassLock'

# Install CLI dependency
npm install

# Start the app
npm run dev
```

---

### 🧩 Planned Enhancements

- Linux/macOS builds
- Browser extensions
- Password history or export feature
- Dark/light theme toggle
- Improved mobile responsiveness
- General UI changes

---

### 📁 Project Structure

```bash
├── index.html         # Web app interface
├── style.css          # Clean dark-themed styles
├── script.js          # Password generation + logic
├── package.json       # App metadata and Tauri scripts
├── src-tauri/         # Tauri backend
└── build/             # (Optional) App icons for builds
```

---

### ⚖ License

MIT — use it freely, tweak it, or build on it.  
Attribution appreciated, but not required.

---

### 📬 Feedback or Contributions?

This was built for fun and personal use — but if you find it useful or want to help expand it, feel free to fork or submit ideas!

GitHub: [polskapeeps/PassLock](https://github.com/polskapeeps/PassLock)

---