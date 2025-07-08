import { Injectable } from "@angular/core";
import { MovieInfo } from "./movie-title-parser.service";

export interface OutputFileConfig {
  format: "mp4" | "mkv" | "avi" | "mov";
  quality: "1080p" | "720p" | "480p" | "4K";
  codec: "h264" | "h265" | "vp9";
  audio: "aac" | "ac3" | "mp3" | "opus";
  crf: number; // Taux de compression (0-51, 20 par défaut)
  group?: string;
}

export interface GeneratedFilename {
  filename: string;
  fullPath: string;
  suggestedPath: string;
}

@Injectable({
  providedIn: "root",
})
export class FilenameGeneratorService {
  private readonly DEFAULT_GROUP = "VideoOptimizer";
  private readonly QUALITY_PRIORITIES = ["4K", "1080p", "720p", "480p"];

  /**
   * Génère un nom de fichier de sortie basé sur les métadonnées du film
   */
  public generateOutputFilename(
    movieInfo: MovieInfo,
    originalPath: string,
    config: OutputFileConfig
  ): GeneratedFilename {
    const baseName = this.generateBaseName(movieInfo, config);
    const extension = config.format;
    const filename = `${baseName}.${extension}`;

    // Générer le chemin de sortie suggéré
    const originalDir = this.getDirectoryFromPath(originalPath);
    const suggestedPath = `${originalDir}/${filename}`;

    return {
      filename,
      fullPath: suggestedPath,
      suggestedPath,
    };
  }

  /**
   * Génère un nom de base pour le fichier
   */
  private generateBaseName(
    movieInfo: MovieInfo,
    config: OutputFileConfig
  ): string {
    const parts: string[] = [];

    // Titre du film/série
    const cleanTitle = this.cleanTitle(movieInfo.title);
    parts.push(cleanTitle);

    // Année
    if (movieInfo.year) {
      parts.push(`(${movieInfo.year})`);
    }

    // Type (Film ou Série)
    const typeLabel = movieInfo.type === "tv" ? "Série" : "Film";
    parts.push(typeLabel);

    // Qualité
    parts.push(config.quality);

    // Codec vidéo
    const codecLabel = this.getCodecLabel(config.codec);
    parts.push(codecLabel);

    // Codec audio
    const audioLabel = this.getAudioLabel(config.audio);
    parts.push(audioLabel);

    return parts.join(".");
  }

  /**
   * Nettoie le titre pour un nom de fichier
   */
  private cleanTitle(title: string): string {
    return title
      .replace(/[<>:"/\\|?*]/g, "") // Supprimer les caractères interdits
      .replace(/\s+/g, ".") // Remplacer les espaces par des points
      .replace(/\.+/g, ".") // Normaliser les points multiples
      .replace(/^\.|\.$/g, "") // Supprimer les points en début/fin
      .trim();
  }

  /**
   * Obtient le label du codec vidéo
   */
  private getCodecLabel(codec: string): string {
    const codecMap: Record<string, string> = {
      h264: "x264",
      h265: "x265",
      vp9: "VP9",
    };
    return codecMap[codec] || codec.toUpperCase();
  }

  /**
   * Obtient le label du codec audio
   */
  private getAudioLabel(audio: string): string {
    const audioMap: Record<string, string> = {
      aac: "AAC",
      ac3: "AC3",
      mp3: "MP3",
      opus: "Opus",
    };
    return audioMap[audio] || audio.toUpperCase();
  }

  /**
   * Extrait le répertoire depuis un chemin de fichier
   */
  private getDirectoryFromPath(filePath: string): string {
    const lastSlashIndex = Math.max(
      filePath.lastIndexOf("/"),
      filePath.lastIndexOf("\\")
    );
    return lastSlashIndex > 0 ? filePath.substring(0, lastSlashIndex) : ".";
  }

  /**
   * Suggère une qualité basée sur la résolution d'origine
   */
  public suggestQuality(
    originalResolution?: string
  ): "1080p" | "720p" | "480p" | "4K" {
    if (!originalResolution) return "1080p";

    const resolution = originalResolution.toLowerCase();

    if (resolution.includes("4k") || resolution.includes("2160")) return "4K";
    if (resolution.includes("1080") || resolution.includes("1920"))
      return "1080p";
    if (resolution.includes("720") || resolution.includes("1280"))
      return "720p";

    return "480p";
  }

  /**
   * Suggère un codec vidéo basé sur la qualité
   */
  public suggestVideoCodec(quality: string): "h264" | "h265" | "vp9" {
    switch (quality) {
      case "4K":
        return "h265"; // Meilleure compression pour 4K
      case "1080p":
        return "h265"; // H.265 par défaut pour 1080p aussi
      default:
        return "h265"; // H.265 par défaut pour tout
    }
  }

  /**
   * Suggère un codec audio basé sur la qualité
   */
  public suggestAudioCodec(quality: string): "aac" | "ac3" | "mp3" | "opus" {
    switch (quality) {
      case "4K":
      case "1080p":
        return "aac"; // Qualité élevée
      case "720p":
        return "mp3"; // Bon compromis
      default:
        return "mp3"; // Compatibilité maximale
    }
  }

  /**
   * Génère une configuration par défaut basée sur les métadonnées
   */
  public generateDefaultConfig(
    originalResolution?: string,
    originalCodec?: string
  ): OutputFileConfig {
    const quality = this.suggestQuality(originalResolution);
    const videoCodec = this.suggestVideoCodec(quality);
    const audioCodec = this.suggestAudioCodec(quality);

    return {
      format: "mkv", // Format MKV par défaut
      quality,
      codec: videoCodec,
      audio: audioCodec,
      crf: 20, // Taux de compression par défaut
      group: this.DEFAULT_GROUP,
    };
  }

  /**
   * Valide un nom de fichier généré
   */
  public validateFilename(filename: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (filename.length > 255) {
      errors.push("Le nom de fichier est trop long (max 255 caractères)");
    }

    if (filename.includes('<>:"/\\|?*')) {
      errors.push("Le nom de fichier contient des caractères interdits");
    }

    if (filename.startsWith(".") || filename.endsWith(".")) {
      errors.push(
        "Le nom de fichier ne peut pas commencer ou finir par un point"
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
