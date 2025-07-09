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
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { VideoFile } from "../../services/files-manager.service";
import { MovieInfoComponent } from "../movie-info/movie-info.component";
import { MovieAlternativesDialogComponent } from "../movie-alternatives-dialog/movie-alternatives-dialog.component";
import { TechnicalDetailsComponent } from "../technical-details/technical-details.component";
import { AudioTracksSectionComponent } from "../audio-tracks-section/audio-tracks-section.component";
import { SubtitleTracksSectionComponent } from "../subtitle-tracks-section/subtitle-tracks-section.component";
import { OutputConfigSectionComponent } from "../output-config-section/output-config-section.component";
import { ConversionSectionComponent } from "../conversion-section/conversion-section.component";
import { FilesManagerService } from "../../services/files-manager.service";
import { SettingsService } from "../../services/settings.service";
import {
  FilenameGeneratorService,
  OutputFileConfig,
  GeneratedFilename,
  AudioTrack,
} from "../../services/filename-generator.service";
import { ConversionService } from "../../services/conversion.service";
import { DirectorySelectorService } from "../../services/directory-selector.service";

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
    MatProgressBarModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MovieInfoComponent,
    TechnicalDetailsComponent,
    AudioTracksSectionComponent,
    SubtitleTracksSectionComponent,
    OutputConfigSectionComponent,
    ConversionSectionComponent,
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
  private readonly conversionService = inject(ConversionService);
  private readonly directorySelector = inject(DirectorySelectorService);

  public readonly outputConfig = signal<OutputFileConfig>({
    format: "mkv",
    quality: "1080p",
    codec: "h265",
    audio: "aac",
    crf: 20,
    group: "VideoOptimizer",
  });

  public readonly generatedFilename = signal<GeneratedFilename | null>(null);

  // Chemin de sortie personnalisé
  public readonly customOutputPath = signal<string | null>(null);

  // Sélections des pistes
  public selectedAudioTracks = new Set<number>();
  public selectedSubtitleTracks = new Set<number>();

  // Getters pour s'assurer que les propriétés sont toujours initialisées
  get audioTracks() {
    return this.selectedVideo()?.audio_tracks || [];
  }

  get subtitleTracks() {
    return this.selectedVideo()?.subtitle_tracks || [];
  }

  // Getter pour l'état de conversion
  get conversionState() {
    return this.conversionService.conversionState();
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
          const selectedTracks = this.getSelectedAudioTracks();
          filename = this.filenameGenerator.generateOutputFilename(
            video.movieInfo,
            video.path,
            config,
            selectedTracks
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

  onAudioTracksChanged(tracks: Set<number>): void {
    this.selectedAudioTracks = tracks;

    // Régénérer le nom de fichier avec les nouvelles pistes audio
    const video = this.selectedVideo();
    if (video && video.movieInfo) {
      const selectedTracks = this.getSelectedAudioTracks();
      const config = this.outputConfig();
      const filename = this.filenameGenerator.generateOutputFilename(
        video.movieInfo,
        video.path,
        config,
        selectedTracks
      );
      this.generatedFilename.set(filename);
    }
  }

  /**
   * Obtient les pistes audio sélectionnées sous forme d'objets AudioTrack
   */
  private getSelectedAudioTracks(): AudioTrack[] {
    const selectedTracks: AudioTrack[] = [];

    this.selectedAudioTracks.forEach((trackIndex) => {
      const track = this.audioTracks.find((t) => t.index === trackIndex);
      if (track) {
        selectedTracks.push({
          index: track.index,
          codec: track.codec,
          language: track.language,
          title: track.title,
          channels: track.channels,
          sample_rate: track.sample_rate,
          bitrate: track.bitrate,
        });
      }
    });

    return selectedTracks;
  }

  onSubtitleTracksChanged(tracks: Set<number>): void {
    this.selectedSubtitleTracks = tracks;
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return "high-confidence";
    if (confidence >= 0.6) return "medium-confidence";
    return "low-confidence";
  }

  onConfigChange(newConfig: Partial<OutputFileConfig>): void {
    const updatedConfig = { ...this.outputConfig(), ...newConfig };
    this.outputConfig.set(updatedConfig);

    // Régénérer le nom de fichier avec la nouvelle configuration
    const video = this.selectedVideo();
    if (video && video.movieInfo) {
      const selectedTracks = this.getSelectedAudioTracks();
      const filename = this.filenameGenerator.generateOutputFilename(
        video.movieInfo,
        video.path,
        updatedConfig,
        selectedTracks
      );
      this.generatedFilename.set(filename);
    }

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

  onFilenameChange(newFilename: string): void {
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

  async selectCustomOutputPath(): Promise<void> {
    const selectedPath = await this.directorySelector.selectDirectory();
    if (selectedPath !== null) {
      this.customOutputPath.set(selectedPath);
    }
  }

  getCurrentOutputPath(): string {
    const video = this.selectedVideo();
    if (!video) return "";

    const customPath = this.customOutputPath();
    if (customPath) {
      return customPath;
    }

    const defaultPath = this.settingsService.getDefaultOutputPath();
    if (defaultPath) {
      return defaultPath;
    }

    // Retourner le répertoire du fichier source
    const inputPath = video.path;
    const lastSlashIndex = Math.max(
      inputPath.lastIndexOf("/"),
      inputPath.lastIndexOf("\\")
    );
    return lastSlashIndex > 0 ? inputPath.substring(0, lastSlashIndex) : ".";
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

  // Méthodes de conversion
  async startConversion(): Promise<void> {
    const video = this.selectedVideo();
    if (!video) return;

    const selectedAudioTracks = Array.from(this.selectedAudioTracks);
    const selectedSubtitleTracks = Array.from(this.selectedSubtitleTracks);

    // Récupérer le nom de fichier généré
    const generatedFilename = this.generatedFilename();
    const outputFilename = generatedFilename?.filename;
    const customPath = this.customOutputPath();

    await this.conversionService.startConversion(
      video,
      this.outputConfig(),
      selectedAudioTracks,
      selectedSubtitleTracks,
      outputFilename,
      customPath
    );
  }

  stopConversion(): void {
    this.conversionService.stopConversion();
  }
}
