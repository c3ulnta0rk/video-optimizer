import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { VideoFile } from "../../services/files-manager.service";

@Component({
  selector: "app-technical-details",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./technical-details.component.html",
  styleUrls: ["./technical-details.component.scss"],
})
export class TechnicalDetailsComponent {
  video = input.required<VideoFile>();

  formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  formatDuration(seconds: number): string {
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
}
