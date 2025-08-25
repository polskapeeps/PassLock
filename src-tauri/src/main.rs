#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng, generic_array::GenericArray},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

const KEY_FILE: &str = "key.bin";
const PASSWORDS_FILE: &str = "passwords.json";

#[derive(Serialize, Deserialize)]
struct PasswordEntry {
    label: String,
    nonce: String,
    ciphertext: String,
}

fn app_dir(handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    tauri::api::path::app_dir(&handle.config()).ok_or("failed to find app dir".to_string())
}

fn load_key(handle: &tauri::AppHandle) -> Result<[u8;32], String> {
    let dir = app_dir(handle)?;
    let key_path = dir.join(KEY_FILE);
    if !key_path.exists() {
        let mut key = [0u8;32];
        OsRng.fill_bytes(&mut key);
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        fs::write(&key_path, &key).map_err(|e| e.to_string())?;
        Ok(key)
    } else {
        let data = fs::read(&key_path).map_err(|e| e.to_string())?;
        if data.len() != 32 {
            return Err("invalid key length".into());
        }
        let mut key = [0u8;32];
        key.copy_from_slice(&data);
        Ok(key)
    }
}

#[tauri::command]
fn save_password(label: String, password: String, handle: tauri::AppHandle) -> Result<(), String> {
    let key_bytes = load_key(&handle)?;
    let cipher = Aes256Gcm::new(GenericArray::from_slice(&key_bytes));

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, password.as_bytes())
        .map_err(|e| e.to_string())?;

    let entry = PasswordEntry {
        label,
        nonce: general_purpose::STANDARD.encode(nonce_bytes),
        ciphertext: general_purpose::STANDARD.encode(ciphertext),
    };

    let dir = app_dir(&handle)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file_path = dir.join(PASSWORDS_FILE);

    let mut entries: Vec<PasswordEntry> = if file_path.exists() {
        let data = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map_err(|e| e.to_string())?
    } else {
        Vec::new()
    };

    entries.push(entry);
    let data = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    fs::write(&file_path, data).map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_password])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
