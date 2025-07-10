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
} from "../../services/conversion.service";
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
  private readonly conversionService = inject(ConversionService);

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

  constructor(private filesManager: FilesManagerService) {
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

  async startConversion(video: VideoFile): Promise<void> {
    // Pour l'instant, on utilise une configuration par défaut
    // TODO: Récupérer la configuration depuis les détails de la vidéo
    const config = {
      format: "mkv" as const,
      quality: "1080p" as const,
      codec: "h265" as const,
      audio: "aac" as const,
      crf: 20,
      group: "VideoOptimizer",
    };

    // Ajouter à la file d'attente
    this.conversionService.addToQueue(
      video,
      config,
      [], // selectedAudioTracks - à récupérer depuis les détails
      [], // selectedSubtitleTracks - à récupérer depuis les détails
      undefined, // outputFilename
      null // customOutputPath
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

    // Ajouter toutes les vidéos sélectionnées à la file d'attente
    const config = {
      format: "mkv" as const,
      quality: "1080p" as const,
      codec: "h265" as const,
      audio: "aac" as const,
      crf: 20,
      group: "VideoOptimizer",
    };

    // Ajouter chaque vidéo sélectionnée à la file d'attente
    for (const videoPath of selectedPaths) {
      const video = this.videoFiles().find((v) => v.path === videoPath);
      if (video) {
        this.conversionService.addToQueue(
          video,
          config,
          [], // selectedAudioTracks - à récupérer depuis les détails
          [], // selectedSubtitleTracks - à récupérer depuis les détails
          undefined, // outputFilename
          null // customOutputPath
        );
      }
    }

    // Lancer toutes les conversions
    await this.conversionService.startAllSelectedConversions(selectedPaths);
  }

  onPosterError(event: Event): void {
    // En cas d'erreur de chargement de l'image, on cache l'image
    const img = event.target as HTMLImageElement;
    img.style.display = "none";
  }
}
