 # 🔑 *PassLock* 🔑

 ---

###### A very minimal password generator build for myself, wanting to avoid opening up a password manager for the same result. Ended up being a while thing. Well, here it is!

###### Intended as just a personal use project, but now planning on future expansion down the road. 
 
---

### 🚀 Whats included

- Adjustable password length (4–28 characters)
- Real-time strength meter with detailed feedback
- Copy-to-clipboard with animated confirmation
- Character type toggles (uppercase, lowercase, numbers, symbols)
- Exclude specific characters or ambiguous ones (`0O1Il|`)
- “Require all selected types” toggle for strict control
- Electron-wrapped desktop app (Windows build ready)

---

### 🛠 Built With

- **HTML/CSS/JavaScript** (Vanilla)
- **Electron** for local desktop app packaging  
- FontAwesome for UI icons  
- Google Fonts (Poppins) for styling

---

### 📦 Getting Started

#### 💻 Run as a Web App

No setup required — just open `index.html` in your browser and go!

#### 🪟 Run Electron App (Desktop)

Make sure you have [Node.js](https://nodejs.org/) installed.

```bash
# Clone the repo
git clone https://github.com/polskapeeps/PassLock

# Navigate to project folder
cd '/path/to/directory/PassLock'

# Install dependencies
npm install

# Start the app in Electron
npm start
```

#### 🛠 Build for Distribution

```bash
npm run dist
```

This creates a Windows installer in the `/dist` folder using Electron Builder.

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
├── main.js            # Electron app entry
├── package.json       # App metadata and build configs
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