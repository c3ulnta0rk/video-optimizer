import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  input,
  output,
  effect,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatTableModule } from "@angular/material/table";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatChipsModule } from "@angular/material/chips";
import { MatTooltipModule } from "@angular/material/tooltip";

export interface VideoFile {
  path: string;
  name: string;
  size?: number;
  duration?: number;
  resolution?: string;
  codec?: string;
  bitrate?: number;
}

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
  ],
  templateUrl: "./videos-table.component.html",
  styleUrls: ["./videos-table.component.scss"],
})
export class VideosTableComponent {
  public readonly videosPaths = input<string[]>([]);

  public readonly videoSelected = output<VideoFile>();
  public readonly videoRemoved = output<string>();

  public readonly videoFiles = signal<VideoFile[]>([]);
  public readonly displayedColumns = ["name", "size", "actions"];

  public readonly selectedVideo = signal<VideoFile | null>(null);

  constructor() {
    effect(() => {
      this.videoFiles.set(this.convertPathsToVideoFiles(this.videosPaths()));
    });
  }

  private convertPathsToVideoFiles(paths: string[]): VideoFile[] {
    return paths.map((path) => ({
      path,
      name: this.extractFileName(path),
      size: 0, // À remplacer par la vraie taille du fichier
      duration: 0, // À remplacer par la vraie durée
      resolution: "Unknown", // À remplacer par la vraie résolution
      codec: "Unknown", // À remplacer par le vrai codec
      bitrate: 0, // À remplacer par le vrai bitrate
    }));
  }

  private extractFileName(path: string): string {
    return path.split("/").pop() || path.split("\\").pop() || path;
  }

  public onVideoClick(video: VideoFile): void {
    this.selectedVideo.set(video);
    this.videoSelected.emit(video);
  }

  public onVideoRemove(video: VideoFile, event: Event): void {
    event.stopPropagation(); // Empêche la sélection de la ligne
    this.videoRemoved.emit(video.path);

    // Si la vidéo supprimée était sélectionnée, on désélectionne
    if (this.selectedVideo()?.path === video.path) {
      this.selectedVideo.set(null);
    }
  }

  public formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  public formatDuration(seconds: number): string {
    if (seconds === 0) return "--:--";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }
}
