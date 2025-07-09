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
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import {
  FilesManagerService,
  VideoFile,
} from "../../services/files-manager.service";
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
    MatDialogModule,
  ],
  templateUrl: "./videos-table.component.html",
  styleUrls: ["./videos-table.component.scss"],
})
export class VideosTableComponent {
  public readonly videoSelected = output<VideoFile>();
  public readonly videoRemoved = output<string>();
  private readonly dialog = inject(MatDialog);

  public readonly displayedColumns = signal<string[]>([
    "name",
    "size",
    "movieTitle",
    "actions",
  ]);
  public readonly videoFiles = computed(() => this.filesManager.videoFiles());

  constructor(private filesManager: FilesManagerService) {}

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
}
