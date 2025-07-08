import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { FfmpegFormatsService } from "../../services/ffmpeg-formats.service";

@Component({
  selector: "app-ffmpeg-test",
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <mat-card class="test-card">
      <mat-card-header>
        <mat-card-title>Test Module FFmpeg</mat-card-title>
        <mat-card-subtitle
          >Vérification des formats supportés</mat-card-subtitle
        >
      </mat-card-header>

      <mat-card-content>
        <div class="status">
          <p>
            <strong>État FFmpeg:</strong>
            <span
              [class]="ffmpegInfo().available ? 'available' : 'unavailable'"
            >
              {{ ffmpegInfo().available ? "Disponible" : "Non disponible" }}
            </span>
          </p>

          <p>
            <strong>Formats trouvés:</strong> {{ ffmpegInfo().formats.length }}
          </p>

          <div *ngIf="ffmpegInfo().loading" class="loading">
            <mat-icon>hourglass_empty</mat-icon>
            Chargement en cours...
          </div>

          <div *ngIf="ffmpegInfo().error" class="error">
            <mat-icon>error</mat-icon>
            {{ ffmpegInfo().error }}
          </div>
        </div>

        <div
          *ngIf="ffmpegInfo().available && ffmpegInfo().formats.length > 0"
          class="formats-preview"
        >
          <h4>Formats courants:</h4>
          <div class="formats-list">
            <span *ngFor="let format of getCommonFormats()" class="format-tag">
              {{ format.name }}
            </span>
          </div>
        </div>
      </mat-card-content>

      <mat-card-actions>
        <button mat-raised-button color="primary" (click)="refreshFormats()">
          <mat-icon>refresh</mat-icon>
          Actualiser
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [
    `
      .test-card {
        margin: 16px;
        max-width: 500px;
      }

      .status {
        margin-bottom: 16px;
      }

      .available {
        color: #4caf50;
        font-weight: bold;
      }

      .unavailable {
        color: #f44336;
        font-weight: bold;
      }

      .loading {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #2196f3;
      }

      .error {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #f44336;
      }

      .formats-preview {
        margin-top: 16px;
      }

      .formats-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }

      .format-tag {
        background: #e3f2fd;
        color: #1976d2;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.9rem;
      }
    `,
  ],
})
export class FfmpegTestComponent {
  private readonly ffmpegService = inject(FfmpegFormatsService);

  public readonly ffmpegInfo = this.ffmpegService.ffmpegInfo;

  public getCommonFormats() {
    return this.ffmpegService.getCommonVideoFormats();
  }

  public async refreshFormats() {
    await this.ffmpegService.refreshFormats();
  }
}
