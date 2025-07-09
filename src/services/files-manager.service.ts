import { effect, inject, Injectable, signal } from "@angular/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { MatDialog } from "@angular/material/dialog";
import {
  MovieTitleParserService,
  MovieInfo,
  MovieSearchResult,
} from "./movie-title-parser.service";
import { FfmpegFormatsService, FfmpegFormat } from "./ffmpeg-formats.service";
import { FfmpegFormatsDialogComponent } from "../components/ffmpeg-formats-dialog/ffmpeg-formats-dialog.component";
import { firstValueFrom } from "rxjs";

export interface AudioTrack {
  index: number;
  codec: string;
  language?: string;
  channels?: number;
  sample_rate?: number;
  bitrate?: number;
  title?: string;
}

export interface SubtitleTrack {
  index: number;
  codec: string;
  language?: string;
  title?: string;
  is_default: boolean;
  is_forced: boolean;
}

export interface VideoFile {
  path: string;
  name: string;
  size?: number;
  duration?: number;
  resolution?: string;
  codec?: string;
  bitrate?: number;
  fps?: number;
  audio_tracks?: AudioTrack[];
  subtitle_tracks?: SubtitleTrack[];
  error?: string;
  loading: boolean;
  movieInfo?: MovieInfo;
  movieInfoLoading?: boolean;
  movieAlternatives?: MovieSearchResult;
}

@Injectable({
  providedIn: "root",
})
export class FilesManagerService {
  public readonly videosPaths = signal<string[]>([]);
  public readonly videoFiles = signal<VideoFile[]>([]);
  public readonly selectedVideo = signal<VideoFile | null>(null);
  public readonly directory = signal<boolean>(false);

  private readonly movieParser = inject(MovieTitleParserService);
  private readonly dialog = inject(MatDialog);
  private readonly ffmpegService = inject(FfmpegFormatsService);

  constructor() {
    effect(() => {
      // Mettre à jour la liste des fichiers
      this.videoFiles.set(this.convertPathsToVideoFiles(this.videosPaths()));

      // Charger automatiquement les infos du film après un délai
      setTimeout(() => {
        this.loadAllMovieInfoSequentially();
      }, 200); // Délai plus long pour laisser le temps aux métadonnées de se charger
    });
  }

  /**
   * Ajoute des chemins de vidéos à la liste
   */
  public async addVideosPaths(paths: string[]) {
    // Ajouter les nouveaux chemins
    const allPaths = [...this.videosPaths(), ...paths];
    this.videosPaths.set(allPaths);

    // Charger automatiquement les métadonnées pour les nouveaux fichiers
    setTimeout(() => {
      this.loadVideoMetadataSequentially();
    }, 100);
  }

  /**
   * Supprime un chemin de vidéo de la liste
   */
  public removeVideoPath(videoPath: string) {
    const currentPaths = this.videosPaths();
    const updatedPaths = currentPaths.filter((path) => path !== videoPath);
    this.videosPaths.set(updatedPaths);

    // Si la vidéo supprimée était sélectionnée, on désélectionne
    if (this.selectedVideo()?.path === videoPath) {
      this.selectedVideo.set(null);
    }
  }

  /**
   * Sélectionne une vidéo
   */
  public selectVideo(video: VideoFile | null) {
    this.selectedVideo.set(video);
  }

  /**
   * Met à jour la liste des fichiers vidéo basée sur les chemins
   */
  private updateVideoFiles() {
    this.videoFiles.set(this.convertPathsToVideoFiles(this.videosPaths()));
    // Cette méthode n'est plus nécessaire car l'effect s'en charge
  }

  /**
   * Convertit les chemins en objets VideoFile
   */
  private convertPathsToVideoFiles(paths: string[]): VideoFile[] {
    return paths.map((path) => ({
      path,
      name: this.extractFileName(path),
      size: 0,
      duration: 0,
      resolution: "Unknown",
      codec: "Unknown",
      bitrate: 0,
      fps: 0,
      loading: true,
    }));
  }

  /**
   * Extrait le nom du fichier depuis le chemin
   */
  private extractFileName(path: string): string {
    return path.split("/").pop() || path.split("\\").pop() || path;
  }

  /**
   * Ouvre le dialogue de sélection de fichiers
   */
  public async selectFiles() {
    const videosPaths: string[] = [];
    const paths = await open({
      multiple: true,
      directory: this.directory(),
      filters: [{ name: "Videos", extensions: ["mp4", "mov", "avi", "mkv"] }],
    });

    if (!paths?.length) {
      return;
    }

    if (this.directory()) {
      for (const path of paths) {
        const scannedVideosPaths = await this.scanDirectoryRecursively(path);
        videosPaths.push(...scannedVideosPaths);
      }
    } else {
      for (const path of paths) {
        if (
          path.endsWith(".mp4") ||
          path.endsWith(".mov") ||
          path.endsWith(".avi") ||
          path.endsWith(".mkv")
        ) {
          videosPaths.push(path);
        }
      }
    }

    // Trier les fichiers par taille avant de les ajouter
    const sortedPaths = await this.sortPathsBySize(videosPaths);
    await this.addVideosPaths(sortedPaths);
  }

  /**
   * Scanne récursivement un répertoire pour trouver des fichiers vidéo
   */
  private async scanDirectoryRecursively(path: string): Promise<string[]> {
    const allVideosPaths: string[] = [];
    const files = await readDir(path);

    for (const file of files) {
      if (file.isDirectory) {
        const newPath = `${path}/${file.name}`;
        const newVideosPaths = await this.scanDirectoryRecursively(newPath);
        allVideosPaths.push(...newVideosPaths);
      } else if (
        file.isFile &&
        (file.name.endsWith(".mp4") ||
          file.name.endsWith(".mov") ||
          file.name.endsWith(".avi") ||
          file.name.endsWith(".mkv"))
      ) {
        const fullPath = `${path}/${file.name}`;
        allVideosPaths.push(fullPath);
      }
    }

    return allVideosPaths;
  }

  /**
   * Trie les chemins de fichiers par taille (du plus grand au plus petit)
   */
  private async sortPathsBySize(paths: string[]): Promise<string[]> {
    const fileInfos = await Promise.all(
      paths.map(async (path) => {
        try {
          const info = await invoke<{ size: number }>("get_file_info", {
            path,
          });
          return { path, size: info.size };
        } catch (error) {
          console.error(
            `Erreur lors de la récupération de la taille pour ${path}:`,
            error
          );
          return { path, size: 0 };
        }
      })
    );

    // Trier par taille décroissante
    return fileInfos.sort((a, b) => b.size - a.size).map((info) => info.path);
  }

  /**
   * Formate la taille d'un fichier en bytes vers une chaîne lisible
   */
  public formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Formate la durée en secondes vers une chaîne lisible
   */
  public formatDuration(seconds: number): string {
    if (seconds === 0) return "--:--";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * Change le mode de sélection (fichiers ou répertoires)
   */
  public toggleDirectoryMode(checked?: boolean) {
    if (checked !== undefined) {
      this.directory.set(checked);
    } else {
      this.directory.set(!this.directory());
    }
  }

  /**
   * Charge les métadonnées pour tous les fichiers vidéo
   */
  public async loadVideoMetadata() {
    const currentFiles = this.videoFiles();

    for (const file of currentFiles) {
      await this.loadSingleVideoMetadata(file.path);
    }
  }

  /**
   * Charge les métadonnées pour tous les fichiers vidéo de manière séquentielle
   * après avoir trié par taille (du plus grand au plus petit)
   */
  public async loadVideoMetadataSequentially() {
    const currentFiles = this.videoFiles();

    // Trier les fichiers par taille (du plus grand au plus petit)
    const sortedFiles = [...currentFiles].sort((a, b) => {
      const sizeA = a.size || 0;
      const sizeB = b.size || 0;
      return sizeB - sizeA; // Tri décroissant
    });

    // Charger les métadonnées séquentiellement
    for (const file of sortedFiles) {
      await this.loadSingleVideoMetadata(file.path);
    }

    // Charger les informations TMDB séquentiellement après les métadonnées
    await this.loadAllMovieInfoSequentially();
  }

  /**
   * Charge les métadonnées pour un fichier vidéo spécifique
   */
  private async loadSingleVideoMetadata(filePath: string) {
    try {
      // Mettre à jour le statut de chargement
      this.updateVideoFileLoading(filePath, true);

      // Appeler la commande Tauri pour récupérer les métadonnées
      const metadata = await invoke<{
        path: string;
        name: string;
        size: number;
        duration?: number;
        resolution?: string;
        codec?: string;
        bitrate?: number;
        fps?: number;
        audio_tracks?: AudioTrack[];
        subtitle_tracks?: SubtitleTrack[];
        error?: string;
      }>("get_video_metadata", { path: filePath });

      // Mettre à jour le fichier avec les métadonnées
      this.updateVideoFileMetadata(filePath, {
        size: metadata.size,
        duration: metadata.duration || 0,
        resolution: metadata.resolution || "Unknown",
        codec: metadata.codec || "Unknown",
        bitrate: metadata.bitrate || 0,
        fps: metadata.fps || 0,
        audio_tracks: metadata.audio_tracks || [],
        subtitle_tracks: metadata.subtitle_tracks || [],
        error: metadata.error,
        loading: false,
      });
    } catch (error) {
      console.error(
        `Erreur lors du chargement des métadonnées pour ${filePath}:`,
        error
      );

      // Mettre à jour avec l'erreur
      this.updateVideoFileMetadata(filePath, {
        error: error instanceof Error ? error.message : "Erreur inconnue",
        loading: false,
      });
    }
  }

  /**
   * Met à jour le statut de chargement d'un fichier vidéo
   */
  private updateVideoFileLoading(filePath: string, loading: boolean) {
    const currentFiles = this.videoFiles();
    const updatedFiles = currentFiles.map((file) =>
      file.path === filePath ? { ...file, loading } : file
    );
    this.videoFiles.set(updatedFiles);
  }

  /**
   * Met à jour les métadonnées d'un fichier vidéo
   */
  private updateVideoFileMetadata(
    filePath: string,
    metadata: Partial<VideoFile>
  ) {
    const currentFiles = this.videoFiles();
    const updatedFiles = currentFiles.map((file) =>
      file.path === filePath ? { ...file, ...metadata } : file
    );
    this.videoFiles.set(updatedFiles);
  }

  /**
   * Vérifie si ffprobe est disponible sur le système
   */
  public async checkFfprobeAvailable(): Promise<boolean> {
    try {
      return await invoke<boolean>("check_ffprobe_available");
    } catch (error) {
      console.error("Erreur lors de la vérification de ffprobe:", error);
      return false;
    }
  }

  /**
   * Charge les informations du film pour un fichier vidéo
   */
  public async loadMovieInfo(filePath: string): Promise<void> {
    const currentFiles = this.videoFiles();
    const fileIndex = currentFiles.findIndex((f) => f.path === filePath);

    if (fileIndex === -1) return;

    // Marquer comme en cours de chargement
    const updatedFiles = [...currentFiles];
    updatedFiles[fileIndex] = {
      ...updatedFiles[fileIndex],
      movieInfoLoading: true,
    };
    this.videoFiles.set(updatedFiles);

    try {
      const fileName = this.extractFileName(filePath);
      const searchResult = await firstValueFrom(
        this.movieParser.searchMovieWithAlternatives(fileName)
      );

      console.log("Movie search result:", searchResult);

      // Si il y a des alternatives, on pourra ouvrir le dialogue plus tard
      // Pour l'instant, on utilise le film sélectionné par défaut
      const movieInfo = searchResult.selected;

      // Mettre à jour avec les infos du film
      const finalFiles = [...this.videoFiles()];
      finalFiles[fileIndex] = {
        ...finalFiles[fileIndex],
        movieInfo,
        movieInfoLoading: false,
      };
      this.videoFiles.set(finalFiles);

      // Stocker les alternatives pour une utilisation future
      if (searchResult.alternatives.length > 1) {
        finalFiles[fileIndex].movieAlternatives = searchResult;
      }
    } catch (error) {
      console.error("Erreur lors du chargement des infos du film:", error);

      // Marquer comme terminé même en cas d'erreur
      const errorFiles = [...this.videoFiles()];
      errorFiles[fileIndex] = {
        ...errorFiles[fileIndex],
        movieInfoLoading: false,
      };
      this.videoFiles.set(errorFiles);
    }
  }

  /**
   * Charge les informations du film pour tous les fichiers
   */
  public async loadAllMovieInfo(): Promise<void> {
    const currentFiles = this.videoFiles();

    for (const file of currentFiles) {
      await this.loadMovieInfo(file.path);
    }
  }

  /**
   * Charge les informations du film pour tous les fichiers de manière séquentielle
   * après avoir trié par taille (du plus grand au plus petit)
   */
  public async loadAllMovieInfoSequentially(): Promise<void> {
    const currentFiles = this.videoFiles();

    // Trier les fichiers par taille (du plus grand au plus petit)
    const sortedFiles = [...currentFiles].sort((a, b) => {
      const sizeA = a.size || 0;
      const sizeB = b.size || 0;
      return sizeB - sizeA; // Tri décroissant
    });

    // Charger les informations TMDB séquentiellement
    for (const file of sortedFiles) {
      await this.loadMovieInfo(file.path);
      // Ajouter un petit délai entre chaque requête pour éviter de surcharger l'API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  /**
   * Ouvre le dialogue de sélection de films alternatifs
   */
  public openMovieAlternativesDialog(
    filePath: string
  ): MovieSearchResult | null {
    const currentFiles = this.videoFiles();
    const file = currentFiles.find((f) => f.path === filePath);

    if (
      file?.movieAlternatives &&
      file.movieAlternatives.alternatives.length > 1
    ) {
      return file.movieAlternatives;
    }

    return null;
  }

  /**
   * Met à jour les informations du film après sélection dans le dialogue
   */
  public updateMovieInfo(filePath: string, movieInfo: MovieInfo): void {
    const currentFiles = this.videoFiles();
    const fileIndex = currentFiles.findIndex((f) => f.path === filePath);

    if (fileIndex === -1) return;

    const updatedFiles = [...currentFiles];
    updatedFiles[fileIndex] = {
      ...updatedFiles[fileIndex],
      movieInfo,
    };
    this.videoFiles.set(updatedFiles);
  }

  /**
   * Ouvre le dialogue des formats FFmpeg disponibles
   */
  public openFfmpegFormatsDialog(): Promise<FfmpegFormat | undefined> {
    const dialogRef = this.dialog.open(FfmpegFormatsDialogComponent, {
      width: "800px",
      maxWidth: "90vw",
      maxHeight: "80vh",
      disableClose: false,
      data: {},
    });

    return dialogRef.afterClosed().toPromise();
  }

  /**
   * Vérifie si un format de sortie est supporté par FFmpeg
   */
  public isOutputFormatSupported(formatName: string): boolean {
    return this.ffmpegService.isFormatSupported(formatName);
  }

  /**
   * Récupère les formats de sortie courants
   */
  public getCommonOutputFormats(): FfmpegFormat[] {
    return this.ffmpegService.getCommonVideoFormats();
  }
}
