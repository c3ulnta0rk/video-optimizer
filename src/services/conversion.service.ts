import { Injectable, signal } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { VideoFile, AudioTrack, SubtitleTrack } from "./files-manager.service";
import { OutputFileConfig } from "./filename-generator.service";
import { SettingsService } from "./settings.service";

export interface MovieMetadata {
  title: string;
  year?: number;
  overview?: string;
  director?: string;
  cast: string[];
  genre: string[];
  rating?: number;
  poster_path?: string;
}

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
  movie_metadata?: MovieMetadata;
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

export interface ConversionQueueItem {
  video: VideoFile;
  config: OutputFileConfig;
  selectedAudioTracks: number[];
  selectedSubtitleTracks: number[];
  outputFilename?: string;
  customOutputPath?: string | null;
  movieMetadata?: MovieMetadata;
  status: "pending" | "converting" | "completed" | "error" | "cancelled";
  progress: ConversionProgress | null;
  result: ConversionResult | null;
  error?: string;
}

export interface ConversionState {
  isConverting: boolean;
  currentConvertingVideo: VideoFile | null;
  queue: ConversionQueueItem[];
  isQueueProcessing: boolean; // Nouveau flag pour éviter les conflits
}

@Injectable({
  providedIn: "root",
})
export class ConversionService {
  private readonly _conversionState = signal<ConversionState>({
    isConverting: false,
    currentConvertingVideo: null,
    queue: [],
    isQueueProcessing: false,
  });

  public readonly conversionState = this._conversionState.asReadonly();

  constructor(private settingsService: SettingsService) {
    this.setupEventListeners();
  }

  private async setupEventListeners(): Promise<void> {
    await listen<{ video_path: string; progress: ConversionProgress }>(
      "conversion_progress",
      (event) => {
        const { video_path, progress } = event.payload;
        this.updateQueueItemProgress(video_path, progress);
      }
    );
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
    customOutputPath?: string | null,
    movieMetadata?: MovieMetadata
  ): Promise<ConversionResult> {
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
      movie_metadata: movieMetadata,
    };

    // Démarrer la conversion
    const result = await invoke<ConversionResult>("start_video_conversion", {
      config: conversionConfig,
    });

    if (result.success) {
      console.log("Conversion réussie:", result.output_path);
    } else {
      console.error("Échec de la conversion:", result.error);
    }

    return result;
  }

  /**
   * Ajoute une vidéo à la file d'attente de conversion
   */
  addToQueue(
    video: VideoFile,
    config: OutputFileConfig,
    selectedAudioTracks: number[],
    selectedSubtitleTracks: number[],
    outputFilename?: string,
    customOutputPath?: string | null,
    movieMetadata?: MovieMetadata
  ): void {
    const queueItem: ConversionQueueItem = {
      video,
      config,
      selectedAudioTracks,
      selectedSubtitleTracks,
      outputFilename,
      customOutputPath,
      movieMetadata,
      status: "pending",
      progress: null,
      result: null,
    };

    this._conversionState.update((state: ConversionState) => ({
      ...state,
      queue: [...state.queue, queueItem],
    }));
  }

  /**
   * Supprime une vidéo de la file d'attente
   */
  removeFromQueue(videoPath: string): void {
    this._conversionState.update((state: ConversionState) => ({
      ...state,
      queue: state.queue.filter((item) => item.video.path !== videoPath),
    }));
  }

  clearQueue(): void {
    this._conversionState.update((state: ConversionState) => ({
      ...state,
      queue: [],
    }));
  }

  /**
   * Démarre la conversion d'une vidéo spécifique de la file d'attente
   */
  async startConversionForVideo(videoPath: string): Promise<void> {
    const state = this._conversionState();
    const queueItem = state.queue.find((item) => item.video.path === videoPath);

    if (!queueItem) {
      console.error("Vidéo non trouvée dans la file d'attente");
      return;
    }

    // Marquer comme en cours de conversion
    this.updateQueueItemStatus(videoPath, "converting");
    this._conversionState.update((state: ConversionState) => ({
      ...state,
      isConverting: true,
      currentConvertingVideo: queueItem.video,
    }));

    try {
      const result = await this.startConversion(
        queueItem.video,
        queueItem.config,
        queueItem.selectedAudioTracks,
        queueItem.selectedSubtitleTracks,
        queueItem.outputFilename,
        queueItem.customOutputPath,
        queueItem.movieMetadata
      );

      // Mettre à jour le résultat
      this.updateQueueItemResult(videoPath, result);

      // Marquer comme terminé
      this.updateQueueItemStatus(videoPath, "completed");
    } catch (error) {
      // Marquer comme erreur
      this.updateQueueItemStatus(
        videoPath,
        "error",
        error instanceof Error ? error.message : "Erreur inconnue"
      );
    } finally {
      // Réinitialiser l'état global
      this._conversionState.update((state: ConversionState) => ({
        ...state,
        isConverting: false,
        currentConvertingVideo: null,
      }));
    }
  }

  /**
   * Démarre la conversion séquentielle de toutes les vidéos sélectionnées
   * Cette méthode assure que les conversions se font une par une
   */
  async startSequentialConversions(
    selectedVideoPaths: string[]
  ): Promise<void> {
    const state = this._conversionState();

    // Vérifier si une conversion est déjà en cours
    if (state.isQueueProcessing) {
      console.log("Une conversion est déjà en cours, veuillez attendre");
      return;
    }

    const pendingItems = state.queue.filter(
      (item) =>
        selectedVideoPaths.includes(item.video.path) &&
        item.status === "pending"
    );

    if (pendingItems.length === 0) {
      console.log("Aucune vidéo sélectionnée pour la conversion");
      return;
    }

    console.log(
      `Démarrage de la conversion séquentielle de ${pendingItems.length} vidéos`
    );

    // Marquer que le traitement de la file d'attente a commencé
    this._conversionState.update((state: ConversionState) => ({
      ...state,
      isQueueProcessing: true,
    }));

    try {
      // Traiter les vidéos une par une
      for (const item of pendingItems) {
        // Vérifier si on a été interrompu
        if (!this._conversionState().isQueueProcessing) {
          console.log("Traitement de la file d'attente interrompu");
          break;
        }

        try {
          // Marquer comme en cours de conversion
          this.updateQueueItemStatus(item.video.path, "converting");
          this._conversionState.update((state: ConversionState) => ({
            ...state,
            isConverting: true,
            currentConvertingVideo: item.video,
          }));

          const result = await this.startConversion(
            item.video,
            item.config,
            item.selectedAudioTracks,
            item.selectedSubtitleTracks,
            item.outputFilename,
            item.customOutputPath,
            item.movieMetadata
          );

          // Mettre à jour le résultat
          this.updateQueueItemResult(item.video.path, result);

          // Marquer comme terminé
          this.updateQueueItemStatus(item.video.path, "completed");
        } catch (error) {
          // Marquer comme erreur
          this.updateQueueItemStatus(
            item.video.path,
            "error",
            error instanceof Error ? error.message : "Erreur inconnue"
          );
        } finally {
          // Réinitialiser l'état global
          this._conversionState.update((state: ConversionState) => ({
            ...state,
            isConverting: false,
            currentConvertingVideo: null,
          }));
        }
      }
    } finally {
      // Marquer que le traitement de la file d'attente est terminé
      this._conversionState.update((state: ConversionState) => ({
        ...state,
        isQueueProcessing: false,
      }));
    }
  }

  /**
   * Met à jour le statut d'un élément de la file d'attente
   */
  private updateQueueItemStatus(
    videoPath: string,
    status: ConversionQueueItem["status"],
    error?: string
  ): void {
    this._conversionState.update((state: ConversionState) => ({
      ...state,
      queue: state.queue.map((item) =>
        item.video.path === videoPath ? { ...item, status, error } : item
      ),
    }));
  }

  /**
   * Met à jour la progression d'un élément de la file d'attente
   */
  updateQueueItemProgress(
    videoPath: string,
    progress: ConversionProgress
  ): void {
    this._conversionState.update((state: ConversionState) => ({
      ...state,
      queue: state.queue.map((item) =>
        item.video.path === videoPath ? { ...item, progress } : item
      ),
    }));
  }

  /**
   * Met à jour le résultat d'un élément de la file d'attente
   */
  private updateQueueItemResult(
    videoPath: string,
    result: ConversionResult
  ): void {
    this._conversionState.update((state: ConversionState) => ({
      ...state,
      queue: state.queue.map((item) =>
        item.video.path === videoPath ? { ...item, result } : item
      ),
    }));
  }

  /**
   * Obtient un élément de la file d'attente par chemin de vidéo
   */
  getQueueItem(videoPath: string): ConversionQueueItem | undefined {
    return this._conversionState().queue.find(
      (item) => item.video.path === videoPath
    );
  }

  /**
   * Arrête la conversion en cours
   */
  async stopConversion(): Promise<boolean> {
    try {
      const result = await invoke<boolean>("stop_video_conversion");

      if (result) {
        // Marquer toutes les conversions en cours comme annulées
        this._conversionState.update((state: ConversionState) => ({
          ...state,
          isConverting: false,
          currentConvertingVideo: null,
          isQueueProcessing: false, // Arrêter le traitement de la file d'attente
          queue: state.queue.map((item) =>
            item.status === "converting"
              ? { ...item, status: "cancelled" as const, progress: null }
              : item
          ),
        }));
      }

      return result;
    } catch (error) {
      console.error("Erreur lors de l'arrêt de la conversion:", error);
      return false;
    }
  }

  /**
   * Réinitialise l'état d'une vidéo annulée pour permettre de la relancer
   */
  resetCancelledVideo(videoPath: string): void {
    this._conversionState.update((state: ConversionState) => ({
      ...state,
      queue: state.queue.map((item) =>
        item.video.path === videoPath && item.status === "cancelled"
          ? {
              ...item,
              status: "pending" as const,
              progress: null,
              result: null,
              error: undefined,
            }
          : item
      ),
    }));
  }

  async stopAllConversions(): Promise<boolean> {
    try {
      const result = await invoke<boolean>("stop_video_conversion");

      // Arrêter complètement le traitement de la file d'attente
      this._conversionState.update((state: ConversionState) => ({
        ...state,
        isConverting: false,
        currentConvertingVideo: null,
        isQueueProcessing: false,
        queue: state.queue.map((item) =>
          item.status === "converting"
            ? { ...item, status: "cancelled" as const, progress: null }
            : item
        ),
      }));

      return result;
    } catch (error) {
      console.error("Erreur lors de l'arrêt des conversions:", error);
      return false;
    }
  }

  /**
   * Vérifie s'il y a une conversion en cours
   */
  isConverting(): boolean {
    return this._conversionState().isConverting;
  }

  /**
   * Vérifie si la file d'attente est en cours de traitement
   */
  isQueueProcessing(): boolean {
    return this._conversionState().isQueueProcessing;
  }

  /**
   * Obtient la vidéo actuellement en cours de conversion
   */
  getCurrentConvertingVideo(): VideoFile | null {
    return this._conversionState().currentConvertingVideo;
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
