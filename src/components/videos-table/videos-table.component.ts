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
import { VideoDetailsComponent } from "../video-details/video-details.component";

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
    VideoDetailsComponent,
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

  public readonly selectedVideo = computed(() =>
    this.filesManager.selectedVideo()
  );

  constructor(private filesManager: FilesManagerService) {
    effect(() => {
      // Écouter les changements de vidéo sélectionnée pour émettre l'événement
      const selected = this.selectedVideo();
      if (selected) {
        this.videoSelected.emit(selected);
      }
    });
  }

  public onVideoClick(video: VideoFile): void {
    this.filesManager.selectVideo(video);
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
    const selectedVideo = this.selectedVideo();
    if (selectedVideo) {
      this.onOpenMovieAlternatives(selectedVideo, new Event("click"));
    }
  }

  public onCloseDetails(): void {
    this.clearSelection();
  }
}
