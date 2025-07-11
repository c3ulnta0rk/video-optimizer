import { Component, input, output, inject, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { ConversionService } from "../../services/conversion.service";
import { FileOpenerService } from "../../services/file-opener.service";

@Component({
  selector: "app-conversion-section",
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressBarModule],
  templateUrl: "./conversion-section.component.html",
  styleUrls: ["./conversion-section.component.scss"],
})
export class ConversionSectionComponent {
  public readonly isConverting = input<boolean>(false);
  public readonly hasSelectedVideo = input<boolean>(false);
  public readonly conversionState = input<any>({});
  public readonly currentVideoPath = input<string | null>(null);
  public readonly startConversion = output<void>();
  public readonly stopConversion = output<void>();

  private readonly fileOpener = inject(FileOpenerService);
  private readonly conversionService = inject(ConversionService);

  // Méthodes pour récupérer la progression de la vidéo en cours
  getCurrentProgress() {
    const videoPath = this.currentVideoPath();
    if (!videoPath) return null;

    const queueItem = this.conversionService.getQueueItem(videoPath);
    return queueItem?.progress || null;
  }

  getCurrentResult() {
    const videoPath = this.currentVideoPath();
    if (!videoPath) return null;

    const queueItem = this.conversionService.getQueueItem(videoPath);
    return queueItem?.result || null;
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, "0")}`;
    }
  }

  formatProgress(progress: number): string {
    return `${(progress * 100).toFixed(1)}%`;
  }

  /**
   * Gère les erreurs de conversion avec des messages plus informatifs
   */
  handleConversionError(error: any): string {
    if (error?.message) {
      const errorMessage = error.message;

      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("Timeout")
      ) {
        return "La conversion a pris trop de temps et a été interrompue. Vérifiez que le fichier source n'est pas corrompu et réessayez.";
      }

      if (errorMessage.includes("ffmpeg") || errorMessage.includes("FFmpeg")) {
        return "Erreur FFmpeg: " + errorMessage;
      }

      return errorMessage;
    }

    return "Erreur inconnue lors de la conversion";
  }

  async openOutputFile(): Promise<void> {
    const result = this.getCurrentResult();
    if (result?.success && result.output_path) {
      try {
        await this.fileOpener.openFile(result.output_path);
      } catch (error) {
        console.error("Erreur lors de l'ouverture du fichier:", error);
      }
    }
  }

  async openFileLocation(): Promise<void> {
    const result = this.getCurrentResult();
    if (result?.success && result.output_path) {
      try {
        await this.fileOpener.openFileLocation(result.output_path);
      } catch (error) {
        console.error("Erreur lors de l'ouverture du dossier:", error);
      }
    }
  }
}
