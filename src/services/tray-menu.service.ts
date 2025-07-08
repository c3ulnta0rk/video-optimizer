import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

@Injectable({
  providedIn: "root",
})
export class TrayMenuService {
  constructor() {
    this.initializeTrayMenu();
  }

  private async initializeTrayMenu() {
    try {
      // Créer le menu du tray avec les options "Open" et "Quit"
      await invoke("create_tray_menu", {
        menu: [
          { id: "open", label: "Open" },
          { type: "separator" },
          { id: "quit", label: "Quit" },
        ],
      });

      console.log("Tray menu initialized");
    } catch (error) {
      console.error("Failed to initialize tray menu:", error);
    }
  }

  public async showWindow() {
    try {
      await invoke("show_window");
    } catch (error) {
      console.error("Failed to show window:", error);
    }
  }

  public async hideWindow() {
    try {
      await invoke("hide_window");
    } catch (error) {
      console.error("Failed to hide window:", error);
    }
  }

  public async quitApp() {
    try {
      await invoke("quit_app");
    } catch (error) {
      console.error("Failed to quit app:", error);
    }
  }
}
