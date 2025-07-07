import {
  Component,
  Output,
  EventEmitter,
  signal,
  output,
  effect,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatTableModule } from "@angular/material/table";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatChipsModule } from "@angular/material/chips";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import {
  FilesManagerService,
  VideoFile,
} from "../../services/files-manager.service";

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
  ],
  templateUrl: "./videos-table.component.html",
  styleUrls: ["./videos-table.component.scss"],
})
export class VideosTableComponent {
  public readonly videoSelected = output<VideoFile>();
  public readonly videoRemoved = output<string>();

  public readonly videoFiles = this.filesManager.videoFiles;
  public readonly displayedColumns = ["name", "size", "actions"];

  public readonly selectedVideo = this.filesManager.selectedVideo;

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
}
