// preload.js - Securely Expose APIs to Renderer

const { contextBridge, ipcRenderer } = require('electron');

// --- Whitelist of safe channels ---
// Define the IPC channels that the renderer is allowed to use.
const validSendChannels = [
    'copy-text-to-clipboard', // Example channel for sending text to main
    // Add other channels you intend to send *from* renderer *to* main
    // 'request-save-file'
];
const validReceiveChannels = [
    'copy-response', // Example channel for receiving responses from main
    // Add other channels you intend to receive *in* renderer *from* main
    // 'file-save-result'
];

console.log("Preload script executing...");

// --- Expose protected methods to the renderer process ---
// Use contextBridge to ensure the exposed API cannot be modified by the renderer's scripts.
contextBridge.exposeInMainWorld(
  'electronAPI', // This will be the object available as `window.electronAPI` in script.js
  {
    // --- IPC Sender Function ---
    // Securely wraps ipcRenderer.send
    send: (channel, data) => {
      if (validSendChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
        console.log(`Preload: Sent on [${channel}] with data:`, data);
      } else {
        console.warn(`Preload: Ignored send attempt on invalid channel [${channel}]`);
      }
    },

    // --- IPC Receiver Function ---
    // Securely wraps ipcRenderer.on
    // Use a function that takes the callback, rather than directly exposing ipcRenderer.on
    on: (channel, func) => {
      if (validReceiveChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        const subscription = (event, ...args) => func(...args);
        ipcRenderer.on(channel, subscription);
        console.log(`Preload: Listening on [${channel}]`);

        // Return a cleanup function to remove the listener
        return () => {
          ipcRenderer.removeListener(channel, subscription);
          console.log(`Preload: Removed listener for [${channel}]`);
        };
      } else {
        console.warn(`Preload: Ignored listener setup for invalid channel [${channel}]`);
        return () => {}; // Return no-op cleanup function
      }
    },

    // --- IPC Invoke Function (for request/response) ---
    // Securely wraps ipcRenderer.invoke (if you need two-way communication with Promises)
    // Example: You might use this for file saving dialogs
    // invoke: async (channel, data) => {
    //   const validInvokeChannels = ['save-file']; // Define channels allowed for invoke
    //   if (validInvokeChannels.includes(channel)) {
    //      console.log(`Preload: Invoking [${channel}] with data:`, data);
    //      return await ipcRenderer.invoke(channel, data);
    //   } else {
    //      console.warn(`Preload: Ignored invoke attempt on invalid channel [${channel}]`);
    //      return Promise.reject(new Error(`Invalid invoke channel: ${channel}`));
    //   }
    // }

    // --- You can add other specific, safe functions here ---
    // getPlatform: () => process.platform // Example: Safely expose platform info
  }
);

// Optional: Log successful loading
window.addEventListener('DOMContentLoaded', () => {
  console.log("Preload script finished and DOM is ready.");
});
