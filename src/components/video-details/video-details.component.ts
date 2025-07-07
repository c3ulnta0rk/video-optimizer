import {
  Component,
  Input,
  output,
  inject,
  signal,
  effect,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatChipsModule } from "@angular/material/chips";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { VideoFile } from "../../services/files-manager.service";
import { MovieInfoComponent } from "../movie-info/movie-info.component";
import { MovieAlternativesDialogComponent } from "../movie-alternatives-dialog/movie-alternatives-dialog.component";
import { FilesManagerService } from "../../services/files-manager.service";
import {
  FilenameGeneratorService,
  OutputFileConfig,
  GeneratedFilename,
} from "../../services/filename-generator.service";

@Component({
  selector: "app-video-details",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MovieInfoComponent,
  ],
  templateUrl: "./video-details.component.html",
  styleUrls: ["./video-details.component.scss"],
})
export class VideoDetailsComponent {
  @Input() selectedVideo: VideoFile | null = null;

  public readonly closeDetails = output<void>();

  private readonly dialog = inject(MatDialog);
  private readonly filesManager = inject(FilesManagerService);
  private readonly filenameGenerator = inject(FilenameGeneratorService);

  public readonly outputConfig = signal<OutputFileConfig>({
    format: "mp4",
    quality: "1080p",
    codec: "h264",
    audio: "aac",
    group: "VideoOptimizer",
  });

  public readonly generatedFilename = signal<GeneratedFilename | null>(null);

  constructor() {
    effect(() => {
      // Régénérer le nom de fichier quand la vidéo sélectionnée ou la config change
      const video = this.selectedVideo;
      const config = this.outputConfig();

      if (video?.movieInfo) {
        const defaultConfig = this.filenameGenerator.generateDefaultConfig(
          video.resolution,
          video.codec
        );

        // Mettre à jour la config par défaut si nécessaire
        if (!this.generatedFilename()) {
          this.outputConfig.set(defaultConfig);
        }

        const filename = this.filenameGenerator.generateOutputFilename(
          video.movieInfo,
          video.path,
          config
        );

        this.generatedFilename.set(filename);
      }
    });
  }

  onCloseDetails(): void {
    this.closeDetails.emit();
  }

  onOpenMovieAlternatives(): void {
    if (!this.selectedVideo) return;

    const alternatives = this.filesManager.openMovieAlternativesDialog(
      this.selectedVideo.path
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
            this.selectedVideo!.path,
            selectedMovie
          );
        }
      });
    }
  }

  formatFileSize(bytes: number): string {
    return this.filesManager.formatFileSize(bytes);
  }

  formatDuration(seconds: number): string {
    return this.filesManager.formatDuration(seconds);
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return "high-confidence";
    if (confidence >= 0.6) return "medium-confidence";
    return "low-confidence";
  }

  onConfigChange(newConfig: Partial<OutputFileConfig>): void {
    this.outputConfig.set({ ...this.outputConfig(), ...newConfig });
  }

  onFilenameChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newFilename = target.value;

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
}
