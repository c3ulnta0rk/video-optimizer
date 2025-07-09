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

export interface VideoMetadata {
  path: string;
  name: string;
  size: number;
  duration?: number;
  resolution?: string;
  codec?: string;
  bitrate?: number;
  fps?: number;
  audio_tracks: AudioTrack[];
  subtitle_tracks: SubtitleTrack[];
  error?: string;
}

export interface FfmpegFormat {
  name: string;
  description: string;
  extensions: string[];
}

@Injectable({
  providedIn: "root",
})
export class FfmpegConversionService {
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
   * Vérifie si ffmpeg-next est disponible
   */
  async checkFfmpegAvailable(): Promise<boolean> {
    try {
      return await invoke<boolean>("check_ffmpeg_available_ffmpeg");
    } catch (error) {
      console.error("Erreur lors de la vérification de ffmpeg:", error);
      return false;
    }
  }

  /**
   * Récupère les métadonnées d'une vidéo avec ffmpeg-next
   */
  async getVideoMetadata(path: string): Promise<VideoMetadata> {
    try {
      return await invoke<VideoMetadata>("get_video_metadata_ffmpeg", { path });
    } catch (error) {
      console.error("Erreur lors de la récupération des métadonnées:", error);
      throw error;
    }
  }

  /**
   * Récupère les formats de sortie supportés
   */
  async getOutputFormats(): Promise<FfmpegFormat[]> {
    try {
      return await invoke<FfmpegFormat[]>("get_ffmpeg_output_formats_ffmpeg");
    } catch (error) {
      console.error("Erreur lors de la récupération des formats:", error);
      return [];
    }
  }

  /**
   * Démarre la conversion d'une vidéo avec ffmpeg-next
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

      // Démarrer la conversion avec ffmpeg-next
      const result = await invoke<ConversionResult>(
        "start_video_conversion_ffmpeg",
        {
          config: conversionConfig,
        }
      );

      // Mettre à jour l'état avec le résultat
      this._conversionState.update((state: ConversionState) => ({
        ...state,
        isConverting: false,
        result,
      }));

      if (result.success) {
        console.log("Conversion réussie avec ffmpeg-next:", result.output_path);
      } else {
        console.error("Échec de la conversion avec ffmpeg-next:", result.error);
      }
    } catch (error) {
      console.error("Erreur lors de la conversion avec ffmpeg-next:", error);
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
  async stopConversion(): Promise<void> {
    try {
      await invoke("stop_video_conversion_ffmpeg");

      // Mettre à jour l'état
      this._conversionState.update((state: ConversionState) => ({
        ...state,
        isConverting: false,
        progress: null,
        result: {
          success: false,
          error: "Conversion arrêtée par l'utilisateur",
          duration: 0,
        },
      }));

      console.log("Conversion arrêtée");
    } catch (error) {
      console.error("Erreur lors de l'arrêt de la conversion:", error);

      // Même en cas d'erreur, on arrête l'affichage de progression
      this._conversionState.update((state: ConversionState) => ({
        ...state,
        isConverting: false,
        progress: null,
      }));
    }
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

    // Générer le nom de fichier de sortie
    let outputFilename_final = outputFilename;
    if (!outputFilename_final) {
      const inputFilename = video.name;
      const lastDotIndex = inputFilename.lastIndexOf(".");
      const baseName =
        lastDotIndex > 0
          ? inputFilename.substring(0, lastDotIndex)
          : inputFilename;
      outputFilename_final = `${baseName}_converted.${config.format}`;
    }

    // Construire le chemin complet
    const separator =
      outputDirectory.endsWith("/") || outputDirectory.endsWith("\\")
        ? ""
        : "/";
    return `${outputDirectory}${separator}${outputFilename_final}`;
  }

  /**
   * Formate le temps en secondes en format lisible
   */
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

  /**
   * Formate la progression en pourcentage
   */
  formatProgress(progress: number): string {
    return `${Math.round(progress * 100)}%`;
  }
}
