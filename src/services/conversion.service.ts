import { Injectable, signal } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { VideoFile, AudioTrack, SubtitleTrack } from "./files-manager.service";
import { OutputFileConfig } from "./filename-generator.service";
import { SettingsService } from "./settings.service";

export interface ConversionConfig {
  input_path: string;
  output_path: string;
  format: string;
  quality: string;
  codec: string;
  audio_codec: string;
  crf: number;
  selected_audio_tracks: number[];
  selected_subtitle_tracks: number[];
}

export interface ConversionProgress {
  progress: number; // 0.0 à 1.0
  current_time: number; // en secondes
  total_time: number; // en secondes
  speed: number; // fps
  eta: number; // en secondes
  status: string;
}

export interface ConversionResult {
  success: boolean;
  output_path?: string;
  error?: string;
  duration: number; // en secondes
}

export interface ConversionState {
  isConverting: boolean;
  progress: ConversionProgress | null;
  currentVideo: VideoFile | null;
  result: ConversionResult | null;
}

@Injectable({
  providedIn: "root",
})
export class ConversionService {
  private readonly _conversionState = signal<ConversionState>({
    isConverting: false,
    progress: null,
    currentVideo: null,
    result: null,
  });

  public readonly conversionState = this._conversionState.asReadonly();

  constructor(private settingsService: SettingsService) {
    this.setupEventListeners();
  }

  private async setupEventListeners(): Promise<void> {
    await listen<ConversionProgress>("conversion_progress", (event) => {
      this._conversionState.update((state: ConversionState) => ({
        ...state,
        progress: event.payload,
      }));
    });
  }

  /**
   * Démarre la conversion d'une vidéo
   */
  async startConversion(
    video: VideoFile,
    config: OutputFileConfig,
    selectedAudioTracks: number[],
    selectedSubtitleTracks: number[],
    outputFilename?: string,
    customOutputPath?: string | null
  ): Promise<void> {
    try {
      // Mettre à jour l'état
      this._conversionState.set({
        isConverting: true,
        progress: null,
        currentVideo: video,
        result: null,
      });

      // Préparer la configuration de conversion
      const conversionConfig: ConversionConfig = {
        input_path: video.path,
        output_path: this.generateOutputPath(
          video,
          config,
          outputFilename,
          customOutputPath
        ),
        format: config.format,
        quality: config.quality,
        codec: config.codec,
        audio_codec: config.audio,
        crf: config.crf,
        selected_audio_tracks: selectedAudioTracks,
        selected_subtitle_tracks: selectedSubtitleTracks,
      };

      // Démarrer la conversion
      const result = await invoke<ConversionResult>("start_video_conversion", {
        config: conversionConfig,
      });

      // Mettre à jour l'état avec le résultat
      this._conversionState.update((state: ConversionState) => ({
        ...state,
        isConverting: false,
        result,
      }));

      if (result.success) {
        console.log("Conversion réussie:", result.output_path);
      } else {
        console.error("Échec de la conversion:", result.error);
      }
    } catch (error) {
      console.error("Erreur lors de la conversion:", error);
      this._conversionState.update((state: ConversionState) => ({
        ...state,
        isConverting: false,
        result: {
          success: false,
          error: error instanceof Error ? error.message : "Erreur inconnue",
          duration: 0,
        },
      }));
    }
  }

  /**
   * Arrête la conversion en cours
   */
  stopConversion(): void {
    // TODO: Implémenter l'arrêt de la conversion
    this._conversionState.update((state: ConversionState) => ({
      ...state,
      isConverting: false,
    }));
  }

  /**
   * Génère le chemin de sortie pour la conversion
   */
  private generateOutputPath(
    video: VideoFile,
    config: OutputFileConfig,
    outputFilename?: string,
    customOutputPath?: string | null
  ): string {
    const inputPath = video.path;
    const lastSlashIndex = Math.max(
      inputPath.lastIndexOf("/"),
      inputPath.lastIndexOf("\\")
    );
    const sourceDirectory =
      lastSlashIndex > 0 ? inputPath.substring(0, lastSlashIndex) : ".";

    // Déterminer le répertoire de sortie
    let outputDirectory = sourceDirectory; // Par défaut, même dossier que la source

    // Utiliser le chemin personnalisé si fourni
    if (customOutputPath) {
      outputDirectory = customOutputPath;
    } else {
      // Sinon, utiliser le chemin par défaut des paramètres
      const defaultPath = this.settingsService.getDefaultOutputPath();
      if (defaultPath) {
        outputDirectory = defaultPath;
      }
    }

    // Utiliser le nom de fichier fourni ou générer un nom par défaut
    if (outputFilename) {
      return `${outputDirectory}/${outputFilename}`;
    } else {
      const lastDotIndex = inputPath.lastIndexOf(".");
      const baseName =
        lastDotIndex > 0 ? inputPath.substring(0, lastDotIndex) : inputPath;
      const fileName = baseName.substring(baseName.lastIndexOf("/") + 1);
      return `${outputDirectory}/${fileName}_optimized.${config.format}`;
    }
  }

  /**
   * Formate le temps en format lisible
   */
  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Formate la progression en pourcentage
   */
  formatProgress(progress: number): string {
    return `${(progress * 100).toFixed(1)}%`;
  }
}
