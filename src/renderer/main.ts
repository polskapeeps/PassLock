import "./styles.css";

import { PassLockApp } from "./passlock-app";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal. The app should still work without offline caching.
    });
  });
}

const appRoot = document.getElementById("app");

if (!appRoot) {
  throw new Error("App root element was not found.");
}

const app = new PassLockApp(appRoot);
void app.start();
