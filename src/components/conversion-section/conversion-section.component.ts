import { Component, input, output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { ConversionService } from "../../services/conversion.service";

@Component({
  selector: "app-conversion-section",
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressBarModule],
  templateUrl: "./conversion-section.component.html",
  styleUrls: ["./conversion-section.component.scss"],
})
export class ConversionSectionComponent {
  isConverting = input<boolean>(false);
  hasSelectedVideo = input<boolean>(false);
  conversionState = input<any>({});
  startConversion = output<void>();
  stopConversion = output<void>();

  formatTime(seconds: number): string {
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

  formatProgress(progress: number): string {
    return `${(progress * 100).toFixed(1)}%`;
  }
}
