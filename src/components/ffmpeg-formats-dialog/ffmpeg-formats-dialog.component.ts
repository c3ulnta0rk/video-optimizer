import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatInputModule } from "@angular/material/input";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatChipsModule } from "@angular/material/chips";
import { MatTabsModule } from "@angular/material/tabs";
import { MatCardModule } from "@angular/material/card";
import { MatListModule } from "@angular/material/list";
import {
  FfmpegFormatsService,
  FfmpegFormat,
} from "../../services/ffmpeg-formats.service";

@Component({
  selector: "app-ffmpeg-formats-dialog",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTabsModule,
    MatCardModule,
    MatListModule,
  ],
  templateUrl: "./ffmpeg-formats-dialog.component.html",
  styleUrls: ["./ffmpeg-formats-dialog.component.scss"],
})
export class FfmpegFormatsDialogComponent {
  private readonly ffmpegService = inject(FfmpegFormatsService);
  private readonly dialogRef = inject(
    MatDialogRef<FfmpegFormatsDialogComponent>
  );
  private readonly data = inject(MAT_DIALOG_DATA, { optional: true });

  public readonly ffmpegInfo = this.ffmpegService.ffmpegInfo;
  public searchQuery = "";
  public selectedTab = 0;

  constructor() {
    // Si des données sont passées, on peut les utiliser pour pré-sélectionner un format
  }

  /**
   * Ferme le dialogue
   */
  public close(): void {
    this.dialogRef.close();
  }

  /**
   * Sélectionne un format et ferme le dialogue
   */
  public selectFormat(format: FfmpegFormat): void {
    this.dialogRef.close(format);
  }

  /**
   * Recharge les formats FFmpeg
   */
  public async refreshFormats(): Promise<void> {
    await this.ffmpegService.refreshFormats();
  }

  /**
   * Filtre les formats selon la recherche
   */
  public getFilteredFormats(): FfmpegFormat[] {
    if (!this.searchQuery.trim()) {
      return this.ffmpegInfo().formats;
    }
    return this.ffmpegService.searchFormats(this.searchQuery);
  }

  /**
   * Récupère les formats courants
   */
  public getCommonFormats(): FfmpegFormat[] {
    return this.ffmpegService.getCommonVideoFormats();
  }

  /**
   * Récupère les formats de haute qualité
   */
  public getHighQualityFormats(): FfmpegFormat[] {
    return this.ffmpegService.getHighQualityFormats();
  }

  /**
   * Récupère les formats compatibles mobile
   */
  public getMobileFormats(): FfmpegFormat[] {
    return this.ffmpegService.getMobileCompatibleFormats();
  }

  /**
   * Vérifie si un format est sélectionnable (pour la conversion)
   */
  public isFormatSelectable(format: FfmpegFormat): boolean {
    // Exclure les formats qui ne sont pas vraiment des formats de sortie vidéo
    const nonSelectableFormats = ["image2", "image2pipe", "rawvideo", "null"];
    return !nonSelectableFormats.includes(format.name.toLowerCase());
  }
}
