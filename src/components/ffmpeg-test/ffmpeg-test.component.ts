import { Component, OnInit } from "@angular/core";
import { FfmpegConversionService } from "../../services/ffmpeg-conversion.service";

@Component({
  selector: "app-ffmpeg-test",
  template: `
    <div class="ffmpeg-test">
      <h3>Test FFmpeg-Next</h3>

      <div class="status-section">
        <h4>Statut FFmpeg</h4>
        <p>FFmpeg disponible: {{ ffmpegAvailable ? "Oui" : "Non" }}</p>
        <button (click)="checkFfmpeg()" [disabled]="checking">
          {{ checking ? "Vérification..." : "Vérifier FFmpeg" }}
        </button>
      </div>

      <div class="formats-section" *ngIf="ffmpegAvailable">
        <h4>Formats supportés</h4>
        <div class="formats-list">
          <div *ngFor="let format of formats" class="format-item">
            <strong>{{ format.name }}</strong> - {{ format.description }}
            <br />
            <small>Extensions: {{ format.extensions.join(", ") }}</small>
          </div>
        </div>
        <button (click)="loadFormats()" [disabled]="loadingFormats">
          {{ loadingFormats ? "Chargement..." : "Charger les formats" }}
        </button>
      </div>

      <div class="conversion-section" *ngIf="ffmpegAvailable">
        <h4>Test de conversion</h4>
        <div class="conversion-status">
          <p>
            État:
            {{
              conversionState.isConverting
                ? "Conversion en cours"
                : "En attente"
            }}
          </p>
          <div *ngIf="conversionState.progress" class="progress">
            <p>
              Progression:
              {{ formatProgress(conversionState.progress.progress) }}
            </p>
            <p>
              Temps actuel:
              {{ formatTime(conversionState.progress.current_time) }}
            </p>
            <p>
              Temps total: {{ formatTime(conversionState.progress.total_time) }}
            </p>
            <p>ETA: {{ formatTime(conversionState.progress.eta) }}</p>
            <p>Statut: {{ conversionState.progress.status }}</p>
          </div>
          <div *ngIf="conversionState.result" class="result">
            <p [class]="conversionState.result.success ? 'success' : 'error'">
              {{
                conversionState.result.success
                  ? "Conversion réussie"
                  : "Échec de la conversion"
              }}
            </p>
            <p *ngIf="conversionState.result.output_path">
              Fichier: {{ conversionState.result.output_path }}
            </p>
            <p *ngIf="conversionState.result.error">
              Erreur: {{ conversionState.result.error }}
            </p>
            <p>Durée: {{ formatTime(conversionState.result.duration) }}</p>
          </div>
        </div>
        <button
          (click)="stopConversion()"
          [disabled]="!conversionState.isConverting"
        >
          Arrêter la conversion
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .ffmpeg-test {
        padding: 20px;
        max-width: 600px;
      }

      .status-section,
      .formats-section,
      .conversion-section {
        margin-bottom: 20px;
        padding: 15px;
        border: 1px solid #ddd;
        border-radius: 5px;
      }

      .formats-list {
        margin: 10px 0;
      }

      .format-item {
        margin: 5px 0;
        padding: 5px;
        background: #f5f5f5;
        border-radius: 3px;
      }

      .progress {
        margin: 10px 0;
        padding: 10px;
        background: #e8f4fd;
        border-radius: 3px;
      }

      .result {
        margin: 10px 0;
        padding: 10px;
        border-radius: 3px;
      }

      .result .success {
        color: green;
        font-weight: bold;
      }

      .result .error {
        color: red;
        font-weight: bold;
      }

      button {
        margin: 5px;
        padding: 8px 16px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }

      button:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      button:hover:not(:disabled) {
        background: #0056b3;
      }
    `,
  ],
})
export class FfmpegTestComponent implements OnInit {
  ffmpegAvailable = false;
  checking = false;
  loadingFormats = false;
  formats: any[] = [];
  conversionState: any = {
    isConverting: false,
    progress: null,
    result: null,
  };

  constructor(private ffmpegService: FfmpegConversionService) {}

  ngOnInit() {
    this.checkFfmpeg();
    this.loadFormats();

    // Utiliser le signal directement
    this.conversionState = this.ffmpegService.conversionState();
  }

  async checkFfmpeg() {
    this.checking = true;
    try {
      this.ffmpegAvailable = await this.ffmpegService.checkFfmpegAvailable();
    } catch (error) {
      console.error("Erreur lors de la vérification de FFmpeg:", error);
      this.ffmpegAvailable = false;
    } finally {
      this.checking = false;
    }
  }

  async loadFormats() {
    this.loadingFormats = true;
    try {
      this.formats = await this.ffmpegService.getOutputFormats();
    } catch (error) {
      console.error("Erreur lors du chargement des formats:", error);
      this.formats = [];
    } finally {
      this.loadingFormats = false;
    }
  }

  async stopConversion() {
    try {
      await this.ffmpegService.stopConversion();
    } catch (error) {
      console.error("Erreur lors de l'arrêt de la conversion:", error);
    }
  }

  formatTime(seconds: number): string {
    return this.ffmpegService.formatTime(seconds);
  }

  formatProgress(progress: number): string {
    return this.ffmpegService.formatProgress(progress);
  }
}
