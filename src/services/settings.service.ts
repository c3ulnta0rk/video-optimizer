import { Injectable, inject } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { Store, load } from "@tauri-apps/plugin-store";
import { OutputFileConfig } from "./filename-generator.service";
import { NotificationService } from "./notification.service";

export interface AppSettings {
  tmdbApiKey: string;
  theme: "light" | "dark" | "auto";
  videoConfig: OutputFileConfig;
  defaultOutputPath: string | null; // Chemin de sortie par défaut (null = même dossier que source)
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

  private readonly notificationService = inject(NotificationService);

  constructor() {
    this.initializeStore();
  }

  private async initializeStore(): Promise<void> {
    try {
      this.store = await load(".settings.dat");
      await this.loadSettings();
    } catch (error) {
      this.notificationService.showErrorWithDetails(
        "Impossible d'initialiser les paramètres, utilisation des valeurs par défaut",
        error
      );
      // Fallback to default settings if store fails to initialize
      this.settingsSubject.next(this.getDefaultSettings());
    }
  }

  private getDefaultSettings(): AppSettings {
    return {
      tmdbApiKey: "",
      theme: "auto",
      videoConfig: {
        format: "mkv",
        quality: "1080p",
        codec: "h265",
        audio: "aac",
        crf: 20,
        group: "VideoOptimizer",
      },
      defaultOutputPath: null, // Par défaut, utiliser le même dossier que la source
    };
  }

  private async loadSettings(): Promise<void> {
    try {
      if (!this.store) {
        this.notificationService.showWarning(
          "Stockage des paramètres non initialisé, utilisation des valeurs par défaut"
        );
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
      this.notificationService.showErrorWithDetails(
        "Impossible de charger les paramètres, utilisation des valeurs par défaut",
        error
      );
      // Use default settings on error
      this.settingsSubject.next(this.getDefaultSettings());
    }
  }

  private async saveSettings(settings: AppSettings): Promise<void> {
    try {
      if (!this.store) {
        this.notificationService.showWarning(
          "Impossible de sauvegarder les paramètres : stockage non initialisé"
        );
        return;
      }

      await this.store.set(this.STORE_KEY, settings);
      await this.store.save();
      this.settingsSubject.next(settings);
    } catch (error) {
      this.notificationService.showErrorWithDetails(
        "Impossible de sauvegarder les paramètres",
        error,
        { action: "Réessayer" }
      );
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

  getVideoConfig(): OutputFileConfig {
    return this.getSettings().videoConfig;
  }

  async setVideoConfig(config: OutputFileConfig): Promise<void> {
    await this.updateSettings({ videoConfig: config });
  }

  async updateVideoConfig(updates: Partial<OutputFileConfig>): Promise<void> {
    const currentConfig = this.getVideoConfig();
    const newConfig = { ...currentConfig, ...updates };
    await this.setVideoConfig(newConfig);
  }

  getDefaultOutputPath(): string | null {
    return this.getSettings().defaultOutputPath;
  }

  async setDefaultOutputPath(path: string | null): Promise<void> {
    await this.updateSettings({ defaultOutputPath: path });
  }

  toggleTheme() {
    const currentTheme = this.getTheme();
    const newTheme = currentTheme === "light" ? "dark" : "light";
    this.setTheme(newTheme);
  }
}
