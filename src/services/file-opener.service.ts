import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

@Injectable({
  providedIn: "root",
})
export class FileOpenerService {
  /**
   * Ouvre un fichier avec l'application par défaut du système
   */
  async openFile(filePath: string): Promise<void> {
    try {
      await invoke("open_file", { path: filePath });
    } catch (error) {
      console.error("Erreur lors de l'ouverture du fichier:", error);
      throw error;
    }
  }

  /**
   * Ouvre le dossier contenant le fichier
   */
  async openFileLocation(filePath: string): Promise<void> {
    try {
      // Extraire le dossier du chemin de fichier côté JavaScript
      const lastSlashIndex = Math.max(
        filePath.lastIndexOf("/"),
        filePath.lastIndexOf("\\")
      );
      const dir =
        lastSlashIndex > 0 ? filePath.substring(0, lastSlashIndex) : ".";

      await invoke("open_folder", { path: dir });
    } catch (error) {
      console.error("Erreur lors de l'ouverture du dossier:", error);
      throw error;
    }
  }
}
