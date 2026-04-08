import { DEFAULT_GENERATOR_OPTIONS } from "../shared/constants";
import { BrowserVaultRepository } from "../shared/browser-store";
import { ElectronVaultRepository } from "../shared/electron-store";
import { calculatePasswordStrength } from "../shared/generator";
import { SupabaseSyncService } from "../shared/sync-service";
import type {
  AuthState,
  ElectronVaultBridge,
  GeneratorOptions,
  PasswordStrength,
  VaultEntry,
  VaultEntryDraft,
  VaultRepository,
  VaultSession,
} from "../shared/types";
import { VaultService } from "../shared/vault-service";

declare global {
  interface Window {
    passlock?: ElectronVaultBridge;
  }
}

type Notice = {
  tone: "info" | "error" | "success";
  message: string;
};

type AppState = {
  session: VaultSession | null;
  auth: AuthState;
  entries: VaultEntry[];
  search: string;
  generatorOptions: GeneratorOptions;
  generatedPassword: string;
  generatedStrength: PasswordStrength;
  draft: VaultEntryDraft;
  setupPassword: string;
  setupPasswordConfirm: string;
  unlockPassword: string;
  authEmail: string;
  authPassword: string;
  notice: Notice | null;
  saving: boolean;
};

const EMPTY_DRAFT: VaultEntryDraft = {
  title: "",
  username: "",
  password: "",
  url: "",
  notes: "",
  tags: [],
};

export class PassLockApp {
  private readonly repository: VaultRepository;
  private readonly vaultService: VaultService;
  private readonly syncService: SupabaseSyncService;
  private state: AppState = {
    session: null,
    auth: { isConfigured: false, isAuthenticated: false, email: null },
    entries: [],
    search: "",
    generatorOptions: DEFAULT_GENERATOR_OPTIONS,
    generatedPassword: "",
    generatedStrength: calculatePasswordStrength(""),
    draft: { ...EMPTY_DRAFT },
    setupPassword: "",
    setupPasswordConfirm: "",
    unlockPassword: "",
    authEmail: "",
    authPassword: "",
    notice: null,
    saving: false,
  };

  constructor(private readonly root: HTMLElement) {
    this.repository = window.passlock?.app.isElectron()
      ? new ElectronVaultRepository()
      : new BrowserVaultRepository();
    this.vaultService = new VaultService(this.repository);
    this.syncService = new SupabaseSyncService(this.repository);
  }

  async start() {
    this.bindEvents();
    await this.refreshState();
    this.render();

    window.passlock?.app.onLockRequested(() => {
      this.vaultService.lock();
      void this.refreshState("Vault locked from the tray.");
    });

    window.passlock?.sync.onSyncRequested(() => {
      void this.runSync();
    });
  }

  private bindEvents() {
    this.root.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target;
      if (form instanceof HTMLFormElement) {
        void this.handleSubmit(form.id);
      }
    });

    this.root.addEventListener("click", (event) => {
      const target =
        event.target instanceof HTMLElement
          ? event.target.closest<HTMLElement>("[data-action]")
          : null;

      if (target) {
        void this.handleAction(target.dataset.action ?? "", target);
      }
    });

    this.root.addEventListener("input", (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        this.handleInput(target);
      }
    });

    this.root.addEventListener("change", (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement) {
        this.handleInput(target);
      }
    });
  }

  private async refreshState(noticeMessage?: string) {
    const [session, auth] = await Promise.all([
      this.vaultService.getSession(),
      this.syncService.getAuthState(),
    ]);

    const entries =
      session.isUnlocked ? await this.vaultService.listEntries(this.state.search) : [];

    this.state = {
      ...this.state,
      session,
      auth,
      entries,
      notice: noticeMessage ? { tone: "success", message: noticeMessage } : this.state.notice,
    };
    this.render();
  }

  private async handleSubmit(formId: string) {
    try {
      this.state.saving = true;
      this.render();

      if (formId === "setup-form") {
        await this.vaultService.setupMasterPassword(
          this.state.setupPassword,
          this.state.setupPasswordConfirm
        );
        this.state.setupPassword = "";
        this.state.setupPasswordConfirm = "";
        this.state.unlockPassword = "";
        await this.refreshState("Vault created and unlocked.");
      }

      if (formId === "unlock-form") {
        await this.vaultService.unlock(this.state.unlockPassword);
        this.state.unlockPassword = "";
        await this.refreshState("Vault unlocked.");
      }

      if (formId === "entry-form") {
        await this.vaultService.saveEntry(this.state.draft);
        this.state.draft = {
          ...EMPTY_DRAFT,
          password: this.state.generatedPassword || "",
        };
        await this.refreshState("Vault entry saved.");
      }

      if (formId === "auth-form") {
        await this.syncService.signIn(this.state.authEmail.trim(), this.state.authPassword);
        this.state.authPassword = "";
        await this.refreshState("Signed in to Supabase.");
      }

    } catch (error) {
      this.state.notice = {
        tone: "error",
        message: error instanceof Error ? error.message : "Something went wrong.",
      };
    } finally {
      this.state.saving = false;
      this.render();
    }
  }

  private async handleAction(action: string, target: HTMLElement) {
    try {
      switch (action) {
        case "generate-password": {
          const { password, strength } = this.vaultService.generatePassword(this.state.generatorOptions);
          this.state.generatedPassword = password;
          this.state.generatedStrength = strength;
          this.state.draft = { ...this.state.draft, password };
          this.state.notice = { tone: "success", message: "New password generated." };
          break;
        }
        case "copy-generated": {
          if (!this.state.generatedPassword) {
            throw new Error("Generate a password first.");
          }

          await this.copySecret(this.state.generatedPassword);
          this.state.notice = {
            tone: "success",
            message: "Generated password copied to the clipboard.",
          };
          break;
        }
        case "copy-entry-password": {
          const entryId = target.dataset.entryId ?? "";
          const entry = this.state.entries.find((item) => item.id === entryId);
          if (!entry) {
            throw new Error("Vault entry not found.");
          }

          await this.copySecret(entry.password);
          this.state.notice = {
            tone: "success",
            message: `Copied password for ${entry.title}.`,
          };
          break;
        }
        case "edit-entry": {
          const entryId = target.dataset.entryId ?? "";
          const entry = this.state.entries.find((item) => item.id === entryId);
          if (!entry) {
            throw new Error("Vault entry not found.");
          }

          this.state.draft = {
            id: entry.id,
            title: entry.title,
            username: entry.username,
            password: entry.password,
            url: entry.url,
            notes: entry.notes,
            tags: [...entry.tags],
          };
          this.state.notice = { tone: "info", message: `Editing ${entry.title}.` };
          break;
        }
        case "delete-entry": {
          await this.vaultService.deleteEntry(target.dataset.entryId ?? "");
          await this.refreshState("Vault entry deleted.");
          return;
        }
        case "lock-vault": {
          this.vaultService.lock();
          await this.refreshState("Vault locked.");
          return;
        }
        case "new-entry": {
          this.state.draft = { ...EMPTY_DRAFT, password: this.state.generatedPassword || "" };
          this.state.notice = null;
          break;
        }
        case "export-vault": {
          const content = await this.vaultService.exportVault();
          const blob = new Blob([content], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `passlock-export-${new Date().toISOString().slice(0, 10)}.json`;
          anchor.click();
          URL.revokeObjectURL(url);
          this.state.notice = { tone: "success", message: "Encrypted vault export created." };
          break;
        }
        case "import-vault": {
          this.root.querySelector<HTMLInputElement>("#import-file")?.click();
          break;
        }
        case "sign-out": {
          await this.syncService.signOut();
          await this.refreshState("Signed out from sync.");
          return;
        }
        case "sync-now": {
          await this.runSync();
          return;
        }
        case "clear-notice": {
          this.state.notice = null;
          break;
        }
        case "sign-up": {
          await this.syncService.signUp(this.state.authEmail.trim(), this.state.authPassword);
          this.state.authPassword = "";
          await this.refreshState("Account created. Check your email if confirmation is enabled.");
          return;
        }
        default:
          break;
      }
    } catch (error) {
      this.state.notice = {
        tone: "error",
        message: error instanceof Error ? error.message : "Something went wrong.",
      };
    }

    this.render();
  }

  private handleInput(target: HTMLInputElement | HTMLTextAreaElement) {
    const { name } = target;

    if (name === "setupPassword" && target instanceof HTMLInputElement) this.state.setupPassword = target.value;
    if (name === "setupPasswordConfirm" && target instanceof HTMLInputElement)
      this.state.setupPasswordConfirm = target.value;
    if (name === "unlockPassword" && target instanceof HTMLInputElement) this.state.unlockPassword = target.value;

    if (name === "search" && target instanceof HTMLInputElement) {
      this.state.search = target.value;
      if (this.state.session?.isUnlocked) {
        void this.vaultService.listEntries(target.value).then((entries) => {
          this.state.entries = entries;
          this.render();
        });
      }
    }

    if (name === "title") this.state.draft.title = target.value;
    if (name === "username") this.state.draft.username = target.value;
    if (name === "password") this.state.draft.password = target.value;
    if (name === "url") this.state.draft.url = target.value;
    if (name === "notes") this.state.draft.notes = target.value;
    if (name === "tags") {
      this.state.draft.tags = target.value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    if (name === "authEmail" && target instanceof HTMLInputElement) this.state.authEmail = target.value;
    if (name === "authPassword" && target instanceof HTMLInputElement) this.state.authPassword = target.value;

    if (target instanceof HTMLInputElement && target.type === "range" && name === "length") {
      this.state.generatorOptions.length = Number(target.value);
      const helper = target.parentElement?.querySelector("small");
      if (helper) {
        helper.textContent = `${this.state.generatorOptions.length} characters`;
      }
      return;
    }

    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      if (name in this.state.generatorOptions) {
        (this.state.generatorOptions as Record<string, unknown>)[name] = target.checked;
      }

      if (name === "closeToTray" || name === "launchHidden") {
        void this.saveDesktopSettings(name, target.checked);
      }
    }

    if (name === "excludeCharacters") this.state.generatorOptions.excludeCharacters = target.value;

    if (name === "clipboardClearMs" && target instanceof HTMLInputElement) {
      void this.saveSettings({ clipboardClearMs: Number(target.value) * 1000 });
    }

    if (target instanceof HTMLInputElement && target.type === "file" && target.files?.[0]) {
      const file = target.files[0];
      void file
        .text()
        .then((content) => this.vaultService.importVault(content))
        .then(() => this.refreshState("Encrypted vault import completed."))
        .catch((error) => {
          this.state.notice = {
            tone: "error",
            message: error instanceof Error ? error.message : "Unable to import the vault export.",
          };
          this.render();
        })
        .finally(() => {
          target.value = "";
        });

      return;
    }
  }

  private async saveDesktopSettings(key: "closeToTray" | "launchHidden", value: boolean) {
    await this.saveSettings({ [key]: value });
    await window.passlock?.app.saveDesktopSettings({
      closeToTray:
        key === "closeToTray" ? value : Boolean(this.state.session?.settings.closeToTray ?? true),
      launchHidden:
        key === "launchHidden" ? value : Boolean(this.state.session?.settings.launchHidden ?? false),
    });
    await this.refreshState();
  }

  private async saveSettings(partial: Partial<VaultSession["settings"]>) {
    await this.vaultService.saveSettings(partial);
    await this.refreshState("Settings saved.");
  }

  private async runSync() {
    try {
      const result = await this.syncService.syncNow();
      await this.refreshState(
        `Sync complete. Uploaded ${result.uploaded}, downloaded ${result.downloaded}, deleted ${result.deleted}.`
      );
    } catch (error) {
      this.state.notice = {
        tone: "error",
        message: error instanceof Error ? error.message : "Sync failed.",
      };
      this.render();
    }
  }

  private async copySecret(value: string) {
    const clearAfterMs = this.state.session?.settings.clipboardClearMs ?? 0;
    if (window.passlock?.clipboard) {
      await window.passlock.clipboard.copySecret(value, clearAfterMs);
      return;
    }

    await navigator.clipboard.writeText(value);
    if (clearAfterMs > 0) {
      window.setTimeout(() => {
        void navigator.clipboard.readText().then((current) => {
          if (current === value) {
            return navigator.clipboard.writeText("");
          }
          return Promise.resolve();
        });
      }, clearAfterMs);
    }
  }

  private render() {
    const session = this.state.session;
    const settings = session?.settings;
    const strengthPercent = this.state.generatedStrength.score;

    this.root.innerHTML = `
      <div class="app-shell ${window.passlock?.app.isElectron() ? "is-electron" : ""}">
        <header class="hero">
          <div class="hero__copy">
            <span class="hero__eyebrow">PassLock 2.0</span>
            <h1>Local-first password management with secure generation and optional sync.</h1>
            <p>Modern by default, encrypted at rest, tray-friendly on desktop, and installable as a PWA.</p>
          </div>
          <div class="hero__actions">
            ${session?.isUnlocked ? `<button class="button button--ghost" data-action="lock-vault">Lock Vault</button>` : ``}
            <button class="button button--primary" data-action="generate-password">Generate</button>
          </div>
        </header>

        ${
          this.state.notice
            ? `<div class="notice notice--${this.state.notice.tone}">
                <span>${escapeHtml(this.state.notice.message)}</span>
                <button class="notice__dismiss" data-action="clear-notice" aria-label="Dismiss notice">&times;</button>
              </div>`
            : ``
        }

        ${
          !session
            ? `<section class="panel"><p>Loading PassLock...</p></section>`
            : !session.hasVault
              ? this.renderSetupPanel()
              : !session.isUnlocked
                ? this.renderUnlockPanel()
                : `
                  <section class="grid">
                    ${this.renderGeneratorPanel(strengthPercent)}
                    ${this.renderSyncPanel()}
                    ${this.renderEntryEditor()}
                    ${this.renderVaultPanel()}
                    ${this.renderSettingsPanel(settings)}
                  </section>
                `
        }
      </div>
    `;
  }

  private renderSetupPanel() {
    return `
      <section class="panel panel--center">
        <div class="panel__header">
          <span class="panel__eyebrow">First run</span>
          <h2>Create your encrypted vault</h2>
          <p>Your master password is required each session and never stored in plaintext.</p>
        </div>
        <form id="setup-form" class="stack">
          <label class="field">
            <span>Master password</span>
            <input type="password" name="setupPassword" value="${escapeAttribute(this.state.setupPassword)}" minlength="12" required />
          </label>
          <label class="field">
            <span>Confirm master password</span>
            <input type="password" name="setupPasswordConfirm" value="${escapeAttribute(this.state.setupPasswordConfirm)}" minlength="12" required />
          </label>
          <button class="button button--primary" type="submit">${this.state.saving ? "Creating..." : "Create Vault"}</button>
        </form>
      </section>
    `;
  }

  private renderUnlockPanel() {
    return `
      <section class="panel panel--center">
        <div class="panel__header">
          <span class="panel__eyebrow">Locked</span>
          <h2>Unlock your vault</h2>
          <p>PassLock decrypts your vault locally after the master password unwraps the vault key.</p>
        </div>
        <form id="unlock-form" class="stack">
          <label class="field">
            <span>Master password</span>
            <input type="password" name="unlockPassword" value="${escapeAttribute(this.state.unlockPassword)}" required />
          </label>
          <button class="button button--primary" type="submit">${this.state.saving ? "Unlocking..." : "Unlock Vault"}</button>
        </form>
      </section>
    `;
  }

  private renderGeneratorPanel(strengthPercent: number) {
    return `
      <section class="panel">
        <div class="panel__header">
          <span class="panel__eyebrow">Generator</span>
          <h2>Generate strong credentials</h2>
        </div>
        <div class="output-card">
          <code>${escapeHtml(this.state.generatedPassword || "Generate a password to get started.")}</code>
          <div class="meter"><div class="meter__bar" style="width:${strengthPercent}%"></div></div>
          <div class="meter__meta">
            <span>${this.state.generatedStrength.label}</span>
            <span>${Math.round(this.state.generatedStrength.entropyBits)} bits</span>
          </div>
          <p class="subtle">${escapeHtml(this.state.generatedStrength.feedback)}</p>
          <div class="inline-actions">
            <button class="button button--primary" data-action="generate-password">Generate</button>
            <button class="button button--secondary" data-action="copy-generated">Copy</button>
            <button class="button button--ghost" data-action="new-entry">Use In Vault</button>
          </div>
        </div>
        <div class="options-grid">
          <label class="field">
            <span>Length</span>
            <input type="range" min="12" max="128" step="1" name="length" value="${this.state.generatorOptions.length}" />
            <small>${this.state.generatorOptions.length} characters</small>
          </label>
          ${this.renderCheckbox("uppercase", "Uppercase", this.state.generatorOptions.uppercase)}
          ${this.renderCheckbox("lowercase", "Lowercase", this.state.generatorOptions.lowercase)}
          ${this.renderCheckbox("numbers", "Numbers", this.state.generatorOptions.numbers)}
          ${this.renderCheckbox("symbols", "Symbols", this.state.generatorOptions.symbols)}
          ${this.renderCheckbox("avoidAmbiguous", "Avoid ambiguous characters", this.state.generatorOptions.avoidAmbiguous)}
          ${this.renderCheckbox("requireEverySelectedType", "Require every selected set", this.state.generatorOptions.requireEverySelectedType)}
          <label class="field field--wide">
            <span>Exclude characters</span>
            <input type="text" name="excludeCharacters" value="${escapeAttribute(this.state.generatorOptions.excludeCharacters)}" placeholder="Type characters to exclude" />
          </label>
        </div>
      </section>
    `;
  }

  private renderVaultPanel() {
    return `
      <section class="panel panel--wide">
        <div class="panel__header panel__header--split">
          <div>
            <span class="panel__eyebrow">Vault</span>
            <h2>Encrypted entries</h2>
          </div>
          <div class="inline-actions">
            <button class="button button--ghost" data-action="export-vault">Export</button>
            <button class="button button--ghost" data-action="import-vault">Import</button>
          </div>
        </div>
        <label class="field">
          <span>Search vault</span>
          <input type="search" name="search" value="${escapeAttribute(this.state.search)}" placeholder="Search titles, usernames, notes, or tags" />
        </label>
        <input id="import-file" type="file" accept="application/json" class="sr-only" />
        <div class="vault-list">
          ${
            this.state.entries.length === 0
              ? `<div class="empty-state">Your vault is empty. Generate a password and save your first entry.</div>`
              : this.state.entries
                  .map(
                    (entry) => `
                      <article class="vault-item">
                        <div class="vault-item__copy">
                          <h3>${escapeHtml(entry.title)}</h3>
                          <p>${escapeHtml(entry.username || "No username")}</p>
                          <small>${escapeHtml(entry.url || "No URL")} &bull; Updated ${formatRelative(entry.updatedAt)}</small>
                        </div>
                        <div class="vault-item__actions">
                          <button class="button button--secondary" data-action="copy-entry-password" data-entry-id="${entry.id}">Copy</button>
                          <button class="button button--ghost" data-action="edit-entry" data-entry-id="${entry.id}">Edit</button>
                          <button class="button button--ghost" data-action="delete-entry" data-entry-id="${entry.id}">Delete</button>
                        </div>
                      </article>
                    `
                  )
                  .join("")
          }
        </div>
      </section>
    `;
  }

  private renderEntryEditor() {
    const isEditing = Boolean(this.state.draft.id);
    return `
      <section class="panel">
        <div class="panel__header panel__header--split">
          <div>
            <span class="panel__eyebrow">Entry editor</span>
            <h2>${isEditing ? "Edit vault entry" : "Save to vault"}</h2>
          </div>
          <button class="button button--ghost" data-action="new-entry">New Entry</button>
        </div>
        <form id="entry-form" class="stack">
          <label class="field"><span>Title</span><input type="text" name="title" value="${escapeAttribute(this.state.draft.title)}" placeholder="GitHub, bank, email, router..." required /></label>
          <label class="field"><span>Username</span><input type="text" name="username" value="${escapeAttribute(this.state.draft.username)}" placeholder="email or login" /></label>
          <label class="field"><span>Password</span><input type="text" name="password" value="${escapeAttribute(this.state.draft.password)}" required /></label>
          <label class="field"><span>URL</span><input type="url" name="url" value="${escapeAttribute(this.state.draft.url)}" placeholder="https://example.com" /></label>
          <label class="field"><span>Tags</span><input type="text" name="tags" value="${escapeAttribute(this.state.draft.tags.join(", "))}" placeholder="personal, finance, work" /></label>
          <label class="field"><span>Notes</span><textarea name="notes" rows="4" placeholder="Anything you want to remember about this credential...">${escapeHtml(this.state.draft.notes)}</textarea></label>
          <button class="button button--primary" type="submit">${this.state.saving ? "Saving..." : isEditing ? "Update Entry" : "Save Entry"}</button>
        </form>
      </section>
    `;
  }

  private renderSyncPanel() {
    return `
      <section class="panel">
        <div class="panel__header">
          <span class="panel__eyebrow">Cloud sync</span>
          <h2>Supabase access</h2>
          <p>Sync uploads only encrypted vault records. The master password never leaves the device.</p>
        </div>
        ${
          !this.state.auth.isConfigured
            ? `<div class="empty-state">Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable sync.</div>`
            : this.state.auth.isAuthenticated
              ? `
                <div class="sync-card">
                  <p>Signed in as <strong>${escapeHtml(this.state.auth.email ?? "unknown user")}</strong></p>
                  <div class="inline-actions">
                    <button class="button button--primary" data-action="sync-now">Sync Now</button>
                    <button class="button button--ghost" data-action="sign-out">Sign Out</button>
                  </div>
                </div>
              `
              : `
                <form id="auth-form" class="stack">
                  <label class="field"><span>Email</span><input type="email" name="authEmail" value="${escapeAttribute(this.state.authEmail)}" required /></label>
                  <label class="field"><span>Password</span><input type="password" name="authPassword" value="${escapeAttribute(this.state.authPassword)}" required /></label>
                  <div class="inline-actions">
                    <button class="button button--primary" type="submit">Sign In</button>
                    <button class="button button--secondary" type="button" data-action="sign-up">Create Account</button>
                  </div>
                </form>
              `
        }
      </section>
    `;
  }

  private renderSettingsPanel(settings?: VaultSession["settings"]) {
    return `
      <section class="panel">
        <div class="panel__header">
          <span class="panel__eyebrow">Settings</span>
          <h2>Clipboard and desktop behavior</h2>
        </div>
        <div class="stack">
          <label class="field">
            <span>Clipboard auto-clear (seconds)</span>
            <input type="number" min="0" max="300" step="5" name="clipboardClearMs" value="${Math.round((settings?.clipboardClearMs ?? 15000) / 1000)}" />
          </label>
          ${this.renderCheckbox("closeToTray", "Close window to tray", settings?.closeToTray ?? true)}
          ${this.renderCheckbox("launchHidden", "Launch hidden in tray", settings?.launchHidden ?? false)}
          <p class="subtle">Desktop-only settings are ignored in the browser, but the encrypted vault format stays the same everywhere.</p>
        </div>
      </section>
    `;
  }

  private renderCheckbox(name: string, label: string, checked: boolean) {
    return `
      <label class="toggle">
        <input type="checkbox" name="${name}" ${checked ? "checked" : ""} />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function formatRelative(value: string) {
  return new Date(value).toLocaleString();
}
