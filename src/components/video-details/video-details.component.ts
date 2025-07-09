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
import { MatCheckboxModule } from "@angular/material/checkbox";
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
    MatCheckboxModule,
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

  // États des sections expansibles
  public audioSectionExpanded = signal(false);
  public subtitleSectionExpanded = signal(false);

  // Sélections des pistes
  private selectedAudioTracks = new Set<number>();
  private selectedSubtitleTracks = new Set<number>();

  // Getters pour s'assurer que les propriétés sont toujours initialisées
  get audioTracks() {
    return this.selectedVideo()?.audio_tracks || [];
  }

  get subtitleTracks() {
    return this.selectedVideo()?.subtitle_tracks || [];
  }

  constructor() {
    // Charger la configuration depuis le store
    this.loadConfigFromStore();

    effect(() => {
      // Régénérer le nom de fichier quand la vidéo sélectionnée ou la config change
      const video = this.selectedVideo();
      const config = this.outputConfig();

      if (video) {
        // Initialiser les sélections des pistes dès qu'une vidéo est sélectionnée
        this.initializeTracksSelections();

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
        this.clearTracksSelections();
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

  // Méthodes pour les sections expansibles
  toggleAudioSection(): void {
    this.audioSectionExpanded.set(!this.audioSectionExpanded());
  }

  toggleSubtitleSection(): void {
    this.subtitleSectionExpanded.set(!this.subtitleSectionExpanded());
  }

  // Initialisation des sélections par défaut
  private initializeTracksSelections(): void {
    this.initializeAudioTracksSelection();
    this.initializeSubtitleTracksSelection();
  }

  private clearTracksSelections(): void {
    this.selectedAudioTracks.clear();
    this.selectedSubtitleTracks.clear();
  }

  private initializeAudioTracksSelection(): void {
    this.selectedAudioTracks.clear();
    // Par défaut, sélectionner toutes les pistes audio
    this.audioTracks.forEach((track) => {
      this.selectedAudioTracks.add(track.index);
    });
  }

  private initializeSubtitleTracksSelection(): void {
    this.selectedSubtitleTracks.clear();
    // Par défaut, sélectionner toutes les pistes de sous-titres
    this.subtitleTracks.forEach((track) => {
      this.selectedSubtitleTracks.add(track.index);
    });
  }

  // Méthodes pour les pistes audio
  getSelectedAudioTracksCount(): number {
    return this.selectedAudioTracks.size;
  }

  isAudioTrackSelected(index: number): boolean {
    return this.selectedAudioTracks.has(index);
  }

  toggleAudioTrack(index: number, checked: boolean): void {
    if (checked) {
      this.selectedAudioTracks.add(index);
    } else {
      this.selectedAudioTracks.delete(index);
    }
  }

  areAllAudioTracksSelected(): boolean {
    return (
      this.selectedAudioTracks.size === this.audioTracks.length &&
      this.audioTracks.length > 0
    );
  }

  areSomeAudioTracksSelected(): boolean {
    return (
      this.selectedAudioTracks.size > 0 &&
      this.selectedAudioTracks.size < this.audioTracks.length
    );
  }

  toggleAllAudioTracks(checked: boolean): void {
    if (checked) {
      this.audioTracks.forEach((track) => {
        this.selectedAudioTracks.add(track.index);
      });
    } else {
      this.selectedAudioTracks.clear();
    }
  }

  // Méthodes pour les pistes de sous-titres
  getSelectedSubtitleTracksCount(): number {
    return this.selectedSubtitleTracks.size;
  }

  isSubtitleTrackSelected(index: number): boolean {
    return this.selectedSubtitleTracks.has(index);
  }

  toggleSubtitleTrack(index: number, checked: boolean): void {
    if (checked) {
      this.selectedSubtitleTracks.add(index);
    } else {
      this.selectedSubtitleTracks.delete(index);
    }
  }

  areAllSubtitleTracksSelected(): boolean {
    return (
      this.selectedSubtitleTracks.size === this.subtitleTracks.length &&
      this.subtitleTracks.length > 0
    );
  }

  areSomeSubtitleTracksSelected(): boolean {
    return (
      this.selectedSubtitleTracks.size > 0 &&
      this.selectedSubtitleTracks.size < this.subtitleTracks.length
    );
  }

  toggleAllSubtitleTracks(checked: boolean): void {
    if (checked) {
      this.subtitleTracks.forEach((track) => {
        this.selectedSubtitleTracks.add(track.index);
      });
    } else {
      this.selectedSubtitleTracks.clear();
    }
  }
}
