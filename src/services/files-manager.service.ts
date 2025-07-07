import { effect, Injectable, signal } from "@angular/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";

export interface VideoFile {
  path: string;
  name: string;
  size?: number;
  duration?: number;
  resolution?: string;
  codec?: string;
  bitrate?: number;
  fps?: number;
  error?: string;
  loading: boolean;
}

@Injectable({
  providedIn: "root",
})
export class FilesManagerService {
  public readonly videosPaths = signal<string[]>([]);
  public readonly videoFiles = signal<VideoFile[]>([]);
  public readonly selectedVideo = signal<VideoFile | null>(null);
  public readonly directory = signal<boolean>(false);

  constructor() {
    effect(() => {
      console.log("Videos paths updated:", this.videosPaths());
      this.updateVideoFiles();
    });

    effect(() => {
      console.log("Selected video:", this.selectedVideo());
    });
  }

  /**
   * Ajoute des chemins de vidéos à la liste
   */
  public async addVideosPaths(paths: string[]) {
    this.videosPaths.set([...this.videosPaths(), ...paths]);

    // Charger automatiquement les métadonnées pour les nouveaux fichiers
    setTimeout(() => {
      this.loadVideoMetadata();
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

    console.log("Vidéo supprimée:", videoPath);
  }

  /**
   * Sélectionne une vidéo
   */
  public selectVideo(video: VideoFile | null) {
    this.selectedVideo.set(video);
    console.log("Vidéo sélectionnée:", video);
  }

  /**
   * Met à jour la liste des fichiers vidéo basée sur les chemins
   */
  private updateVideoFiles() {
    this.videoFiles.set(this.convertPathsToVideoFiles(this.videosPaths()));
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

    await this.addVideosPaths(videosPaths);
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
}
