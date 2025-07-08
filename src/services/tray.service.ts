import { Injectable } from "@angular/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

@Injectable({
  providedIn: "root",
})
export class TrayService {
  private isInitialized = false;

  constructor() {
    this.initializeTray();
  }

  private async initializeTray() {
    if (this.isInitialized) return;

    try {
      // Écouter les événements de fermeture de fenêtre
      const currentWindow = getCurrentWindow();

      // Intercepter la fermeture de fenêtre pour minimiser dans le tray
      currentWindow.onCloseRequested(async (event) => {
        event.preventDefault();
        await this.hideToTray();
      });

      this.isInitialized = true;
      console.log("Tray service initialized");
    } catch (error) {
      console.error("Failed to initialize tray service:", error);
    }
  }

  public async hideToTray() {
    try {
      const currentWindow = getCurrentWindow();
      await currentWindow.hide();
      console.log("Window hidden to tray");
    } catch (error) {
      console.error("Failed to hide window to tray:", error);
    }
  }

  public async showFromTray() {
    try {
      const currentWindow = getCurrentWindow();
      await currentWindow.show();
      await currentWindow.setFocus();
      console.log("Window shown from tray");
    } catch (error) {
      console.error("Failed to show window from tray:", error);
    }
  }

  public async quitApp() {
    try {
      const currentWindow = getCurrentWindow();
      await currentWindow.close();
    } catch (error) {
      console.error("Failed to quit app:", error);
    }
  }
}
