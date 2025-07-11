import {
  Component,
  Output,
  EventEmitter,
  signal,
  output,
  effect,
  inject,
  computed,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatTableModule } from "@angular/material/table";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatChipsModule } from "@angular/material/chips";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import {
  FilesManagerService,
  VideoFile,
} from "../../services/files-manager.service";
import {
  ConversionService,
  ConversionQueueItem,
  MovieMetadata,
} from "../../services/conversion.service";
import { FileOpenerService } from "../../services/file-opener.service";
import { VideoConfigService } from "../../services/video-config.service";
import { MovieAlternativesDialogComponent } from "../movie-alternatives-dialog/movie-alternatives-dialog.component";
import { VideoDetailsDialogComponent } from "../video-details-dialog/video-details-dialog.component";

@Component({
  selector: "app-videos-table",
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatDialogModule,
  ],
  templateUrl: "./videos-table.component.html",
  styleUrls: ["./videos-table.component.scss"],
})
export class VideosTableComponent {
  public readonly videoSelected = output<VideoFile>();
  public readonly videoRemoved = output<string>();
  private readonly dialog = inject(MatDialog);
  public readonly conversionService = inject(ConversionService);
  private readonly filesManager = inject(FilesManagerService);
  private readonly fileOpener = inject(FileOpenerService);
  private readonly videoConfigService = inject(VideoConfigService);

  public readonly displayedColumns = signal<string[]>([
    "name",
    "size",
    "movieTitle",
    "conversion",
    "actions",
  ]);
  public readonly videoFiles = computed(() => this.filesManager.videoFiles());

  // Sélection pour la conversion
  private selectedForConversion = new Set<string>();

  constructor() {
    // Sélectionner toutes les vidéos par défaut pour la conversion
    effect(() => {
      const files = this.videoFiles();
      files.forEach((file) => {
        this.selectedForConversion.add(file.path);
      });
    });
  }

  public onVideoClick(video: VideoFile): void {
    // Ouvrir la dialog des détails de vidéo
    const dialogRef = this.dialog.open(VideoDetailsDialogComponent, {
      width: "1200px",
      maxWidth: "95vw",
      maxHeight: "90vh",
      disableClose: false,
      autoFocus: false,
      data: { video },
    });

    dialogRef.afterClosed().subscribe(() => {
      // Optionnel : faire quelque chose quand la dialog se ferme
    });
  }

  public onVideoRemove(video: VideoFile, event: Event): void {
    event.stopPropagation(); // Empêche la sélection de la ligne
    this.filesManager.removeVideoPath(video.path);
    this.videoRemoved.emit(video.path);
  }

  public clearSelection(): void {
    this.filesManager.selectVideo(null);
  }

  public formatFileSize(bytes: number): string {
    return this.filesManager.formatFileSize(bytes);
  }

  public formatDuration(seconds: number): string {
    return this.filesManager.formatDuration(seconds);
  }

  public onOpenMovieAlternatives(video: VideoFile, event: Event): void {
    event.stopPropagation(); // Empêche la sélection de la ligne

    const alternatives = this.filesManager.openMovieAlternativesDialog(
      video.path
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
          this.filesManager.updateMovieInfo(video.path, selectedMovie);
        }
      });
    }
  }

  public onManualSearch(video: VideoFile, event: Event): void {
    event.stopPropagation(); // Empêche la sélection de la ligne

    this.filesManager
      .openManualSearchDialog(video.path)
      .subscribe((selectedMovie) => {
        if (selectedMovie) {
          this.filesManager.updateMovieInfo(video.path, selectedMovie);
        }
      });
  }

  public getPosterUrl(posterPath: string | undefined): string {
    if (!posterPath) return "assets/no-poster.png";
    return `https://image.tmdb.org/t/p/w200${posterPath}`;
  }

  public onMovieInfoOpenAlternatives(): void {
    const selectedVideo = this.filesManager.selectedVideo();
    if (selectedVideo) {
      this.onOpenMovieAlternatives(selectedVideo, new Event("click"));
    }
  }

  // Méthodes pour la conversion
  getConversionStatus(
    videoPath: string
  ): ConversionQueueItem["status"] | "none" {
    const queueItem = this.conversionService.getQueueItem(videoPath);
    return queueItem ? queueItem.status : "none";
  }

  getConversionProgress(videoPath: string): number {
    const queueItem = this.conversionService.getQueueItem(videoPath);
    return queueItem?.progress?.progress
      ? queueItem.progress.progress * 100
      : 0;
  }

  getConversionProgressText(videoPath: string): string {
    const queueItem = this.conversionService.getQueueItem(videoPath);
    if (!queueItem?.progress) return "";

    const progress = queueItem.progress;
    const percentage = (progress.progress * 100).toFixed(1);
    const eta = this.conversionService.formatTime(progress.eta);
    return `${percentage}% - ETA: ${eta}`;
  }

  isVideoSelectedForConversion(videoPath: string): boolean {
    return this.selectedForConversion.has(videoPath);
  }

  toggleConversionSelection(videoPath: string, checked: boolean): void {
    if (checked) {
      this.selectedForConversion.add(videoPath);
    } else {
      this.selectedForConversion.delete(videoPath);
    }
  }

  async startConversion(event: Event, video: VideoFile): Promise<void> {
    event.stopPropagation(); // Empêche l'ouverture des détails
    // Vérifier si la vidéo était annulée et la réinitialiser
    const queueItem = this.conversionService.getQueueItem(video.path);
    if (queueItem?.status === "cancelled") {
      this.conversionService.resetCancelledVideo(video.path);
    }

    // Récupérer ou créer la configuration pour cette vidéo
    const videoConfig = this.videoConfigService.getOrCreateVideoConfig(video);

    // Ajouter à la file d'attente
    this.conversionService.addToQueue(
      video,
      videoConfig.config,
      videoConfig.selectedAudioTracks,
      videoConfig.selectedSubtitleTracks,
      videoConfig.generatedFilename?.filename,
      videoConfig.customOutputPath,
      videoConfig.movieMetadata
    );

    // Démarrer la conversion
    await this.conversionService.startConversionForVideo(video.path);
  }

  /**
   * Obtient le nombre de vidéos sélectionnées pour la conversion
   */
  getSelectedForConversionCount(): number {
    return this.selectedForConversion.size;
  }

  /**
   * Lance la conversion de toutes les vidéos sélectionnées
   */
  async startAllSelectedConversions(): Promise<void> {
    const selectedPaths = Array.from(this.selectedForConversion);

    if (selectedPaths.length === 0) {
      console.log("Aucune vidéo sélectionnée");
      return;
    }

    // Vérifier si une conversion est déjà en cours
    if (this.conversionService.isQueueProcessing()) {
      console.log("Une conversion est déjà en cours, veuillez attendre");
      return;
    }

    // Ajouter chaque vidéo sélectionnée à la file d'attente
    for (const videoPath of selectedPaths) {
      const video = this.videoFiles().find((v) => v.path === videoPath);
      if (video) {
        // Récupérer ou créer la configuration pour cette vidéo
        const videoConfig =
          this.videoConfigService.getOrCreateVideoConfig(video);

        this.conversionService.addToQueue(
          video,
          videoConfig.config,
          videoConfig.selectedAudioTracks,
          videoConfig.selectedSubtitleTracks,
          videoConfig.generatedFilename?.filename,
          videoConfig.customOutputPath,
          videoConfig.movieMetadata
        );
      }
    }

    // Lancer les conversions de manière séquentielle
    await this.conversionService.startSequentialConversions(selectedPaths);
  }

  /**
   * Arrête toutes les conversions en cours
   */
  async stopAllConversions(): Promise<void> {
    // Empêche l'ouverture des détails
    try {
      const stopped = await this.conversionService.stopAllConversions();
      if (stopped) {
        console.log("Conversions arrêtées avec succès");
      } else {
        console.log("Aucune conversion en cours à arrêter");
      }
    } catch (error) {
      console.error("Erreur lors de l'arrêt des conversions:", error);
    }
  }

  async stopConversion(event: Event): Promise<void> {
    event.stopPropagation(); // Empêche l'ouverture des détails
    await this.conversionService.stopConversion();
  }

  onPosterError(event: Event): void {
    // En cas d'erreur de chargement de l'image, on cache l'image
    const img = event.target as HTMLImageElement;
    img.style.display = "none";
  }

  async openConvertedFile(videoPath: string, event: Event): Promise<void> {
    event.stopPropagation(); // Empêche l'ouverture des détails
    const queueItem = this.conversionService.getQueueItem(videoPath);
    if (queueItem?.result?.success && queueItem.result.output_path) {
      try {
        await this.fileOpener.openFile(queueItem.result.output_path);
      } catch (error) {
        console.error("Erreur lors de l'ouverture du fichier:", error);
      }
    }
  }
}
