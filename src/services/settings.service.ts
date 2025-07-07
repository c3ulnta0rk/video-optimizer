import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { Store, load } from "@tauri-apps/plugin-store";

export interface AppSettings {
  tmdbApiKey: string;
  theme: "light" | "dark" | "auto";
}

@Injectable({
  providedIn: "root",
})
export class SettingsService {
  private readonly STORE_KEY = "app_settings";
  private settingsSubject = new BehaviorSubject<AppSettings>(
    this.getDefaultSettings()
  );
  public settings$ = this.settingsSubject.asObservable();
  private store: Store | null = null;

  constructor() {
    this.initializeStore();
  }

  private async initializeStore(): Promise<void> {
    try {
      this.store = await load(".settings.dat");
      await this.loadSettings();
    } catch (error) {
      console.error("Error initializing store:", error);
      // Fallback to default settings if store fails to initialize
      this.settingsSubject.next(this.getDefaultSettings());
    }
  }

  private getDefaultSettings(): AppSettings {
    return {
      tmdbApiKey: "",
      theme: "auto",
    };
  }

  private async loadSettings(): Promise<void> {
    try {
      if (!this.store) {
        console.warn("Store not initialized, using default settings");
        return;
      }

      const stored = await this.store.get<AppSettings>(this.STORE_KEY);
      if (stored) {
        this.settingsSubject.next({
          ...this.getDefaultSettings(),
          ...stored,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      // Use default settings on error
      this.settingsSubject.next(this.getDefaultSettings());
    }
  }

  private async saveSettings(settings: AppSettings): Promise<void> {
    try {
      if (!this.store) {
        console.warn("Store not initialized, settings not saved");
        return;
      }

      await this.store.set(this.STORE_KEY, settings);
      await this.store.save();
      this.settingsSubject.next(settings);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  getSettings(): AppSettings {
    return this.settingsSubject.value;
  }

  async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    const currentSettings = this.getSettings();
    const newSettings = { ...currentSettings, ...updates };
    await this.saveSettings(newSettings);
  }

  getTmdbApiKey(): string {
    return this.getSettings().tmdbApiKey;
  }

  async setTmdbApiKey(apiKey: string): Promise<void> {
    await this.updateSettings({ tmdbApiKey: apiKey });
  }

  getTheme(): "light" | "dark" | "auto" {
    return this.getSettings().theme;
  }

  async setTheme(theme: "light" | "dark" | "auto"): Promise<void> {
    await this.updateSettings({ theme });
  }
}
