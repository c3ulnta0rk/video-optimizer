import { Injectable } from "@angular/core";
import { open } from "@tauri-apps/plugin-dialog";

@Injectable({
  providedIn: "root",
})
export class DirectorySelectorService {
  /**
   * Ouvre un dialogue pour sélectionner un dossier
   * @returns Promise<string | null> - Le chemin du dossier sélectionné ou null si annulé
   */
  async selectDirectory(): Promise<string | null> {
    try {
      const result = await open({
        multiple: false,
        directory: true,
        title: "Sélectionner un dossier de sortie",
      });

      return result || null;
    } catch (error) {
      console.error("Erreur lors de la sélection du dossier:", error);
      return null;
    }
  }
}
