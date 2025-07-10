import { Component, input, output, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { ConversionService } from "../../services/conversion.service";
import { FileOpenerService } from "../../services/file-opener.service";

@Component({
  selector: "app-conversion-section",
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressBarModule],
  templateUrl: "./conversion-section.component.html",
  styleUrls: ["./conversion-section.component.scss"],
})
export class ConversionSectionComponent {
  public readonly isConverting = input<boolean>(false);
  public readonly hasSelectedVideo = input<boolean>(false);
  public readonly conversionState = input<any>({});
  public readonly startConversion = output<void>();
  public readonly stopConversion = output<void>();

  private readonly fileOpener = inject(FileOpenerService);

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

  async openOutputFile(): Promise<void> {
    const result = this.conversionState();
    if (result?.result?.success && result.result.output_path) {
      try {
        await this.fileOpener.openFile(result.result.output_path);
      } catch (error) {
        console.error("Erreur lors de l'ouverture du fichier:", error);
      }
    }
  }

  async openFileLocation(): Promise<void> {
    const result = this.conversionState();
    if (result?.result?.success && result.result.output_path) {
      try {
        await this.fileOpener.openFileLocation(result.result.output_path);
      } catch (error) {
        console.error("Erreur lors de l'ouverture du dossier:", error);
      }
    }
  }
}
