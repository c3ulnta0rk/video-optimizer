import {
  Component,
  Input,
  output,
  inject,
  signal,
  effect,
  input,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatChipsModule } from "@angular/material/chips";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { VideoFile } from "../../services/files-manager.service";
import { MovieInfoComponent } from "../movie-info/movie-info.component";
import { MovieAlternativesDialogComponent } from "../movie-alternatives-dialog/movie-alternatives-dialog.component";
import { FilesManagerService } from "../../services/files-manager.service";
import { SettingsService } from "../../services/settings.service";
import {
  FilenameGeneratorService,
  OutputFileConfig,
  GeneratedFilename,
} from "../../services/filename-generator.service";

@Component({
  selector: "app-video-details",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MovieInfoComponent,
  ],
  templateUrl: "./video-details.component.html",
  styleUrls: ["./video-details.component.scss"],
})
export class VideoDetailsComponent {
  selectedVideo = input.required<VideoFile>();

  public readonly closeDetails = output<void>();

  private readonly dialog = inject(MatDialog);
  private readonly filesManager = inject(FilesManagerService);
  private readonly filenameGenerator = inject(FilenameGeneratorService);
  private readonly settingsService = inject(SettingsService);

  public readonly outputConfig = signal<OutputFileConfig>({
    format: "mkv",
    quality: "1080p",
    codec: "h265",
    audio: "aac",
    crf: 20,
    group: "VideoOptimizer",
  });

  public readonly generatedFilename = signal<GeneratedFilename | null>(null);

  constructor() {
    // Charger la configuration depuis le store
    this.loadConfigFromStore();

    effect(() => {
      // Régénérer le nom de fichier quand la vidéo sélectionnée ou la config change
      const video = this.selectedVideo();
      const config = this.outputConfig();

      if (video) {
        // Générer le nom de fichier même sans movieInfo
        let filename: GeneratedFilename;

        if (video.movieInfo) {
          // Utiliser les informations du film si disponibles
          filename = this.filenameGenerator.generateOutputFilename(
            video.movieInfo,
            video.path,
            config
          );
        } else {
          // Fallback: utiliser le nom du fichier original
          const baseName = video.name.replace(/\.[^/.]+$/, ""); // Supprimer l'extension
          const extension = config.format;
          const fallbackFilename = `${baseName}.${extension}`;
          const originalDir = this.getDirectoryFromPath(video.path);
          const suggestedPath = `${originalDir}/${fallbackFilename}`;

          filename = {
            filename: fallbackFilename,
            fullPath: suggestedPath,
            suggestedPath,
          };
        }

        this.generatedFilename.set(filename);
      } else {
        // Aucune vidéo sélectionnée, réinitialiser
        this.generatedFilename.set(null);
      }
    });
  }

  /**
   * Charge la configuration depuis le store
   */
  private async loadConfigFromStore(): Promise<void> {
    try {
      const storedConfig = this.settingsService.getVideoConfig();
      this.outputConfig.set(storedConfig);
    } catch (error) {
      console.error("Erreur lors du chargement de la configuration:", error);
      // Garder la configuration par défaut en cas d'erreur
    }
  }

  /**
   * Extrait le répertoire depuis un chemin de fichier
   */
  private getDirectoryFromPath(filePath: string): string {
    const lastSlashIndex = Math.max(
      filePath.lastIndexOf("/"),
      filePath.lastIndexOf("\\")
    );
    return lastSlashIndex > 0 ? filePath.substring(0, lastSlashIndex) : ".";
  }

  onCloseDetails(): void {
    this.closeDetails.emit();
  }

  onOpenMovieAlternatives(): void {
    if (!this.selectedVideo) return;

    const alternatives = this.filesManager.openMovieAlternativesDialog(
      this.selectedVideo().path
    );
    if (alternatives) {
      const dialogRef = this.dialog.open(MovieAlternativesDialogComponent, {
        width: "900px",
        maxWidth: "95vw",
        maxHeight: "90vh",
        disableClose: false,
        autoFocus: false,
        data: { movieResults: alternatives },
      });

      dialogRef.afterClosed().subscribe((selectedMovie) => {
        if (selectedMovie) {
          this.filesManager.updateMovieInfo(
            this.selectedVideo().path,
            selectedMovie
          );
        }
      });
    }
  }

  formatFileSize(bytes: number): string {
    return this.filesManager.formatFileSize(bytes);
  }

  formatDuration(seconds: number): string {
    return this.filesManager.formatDuration(seconds);
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return "high-confidence";
    if (confidence >= 0.6) return "medium-confidence";
    return "low-confidence";
  }

  onConfigChange(newConfig: Partial<OutputFileConfig>): void {
    const updatedConfig = { ...this.outputConfig(), ...newConfig };
    this.outputConfig.set(updatedConfig);

    // Sauvegarder dans le store
    this.settingsService.updateVideoConfig(newConfig).catch((error) => {
      console.error("Erreur lors de la sauvegarde de la configuration:", error);
    });
  }

  onCrfChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const crfValue = parseInt(target.value);
    if (!isNaN(crfValue) && crfValue >= 0 && crfValue <= 51) {
      this.onConfigChange({ crf: crfValue });
    }
  }

  onFilenameChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newFilename = target.value;

    const current = this.generatedFilename();
    if (current) {
      const validation = this.filenameGenerator.validateFilename(newFilename);
      if (validation.isValid) {
        this.generatedFilename.set({
          ...current,
          filename: newFilename,
          fullPath: current.suggestedPath.replace(
            current.filename,
            newFilename
          ),
        });
      }
    }
  }
}
