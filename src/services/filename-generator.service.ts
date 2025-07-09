import { Injectable } from "@angular/core";
import { MovieInfo } from "./movie-title-parser.service";

export interface AudioTrack {
  index: number;
  codec: string;
  language?: string;
  title?: string;
  channels?: number;
  sample_rate?: number;
  bitrate?: number;
}

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
    config: OutputFileConfig,
    selectedAudioTracks?: AudioTrack[]
  ): GeneratedFilename {
    const baseName = this.generateBaseName(
      movieInfo,
      config,
      selectedAudioTracks
    );
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
    config: OutputFileConfig,
    selectedAudioTracks?: AudioTrack[]
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

    // CRF
    parts.push(`CRF${config.crf}`);

    // Informations audio
    const audioInfo = this.getAudioInfo(config.audio, selectedAudioTracks);
    parts.push(audioInfo);

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
   * Génère les informations audio pour le nom de fichier
   */
  private getAudioInfo(
    audioCodec: string,
    selectedAudioTracks?: AudioTrack[]
  ): string {
    const audioLabel = this.getAudioLabel(audioCodec);

    if (!selectedAudioTracks || selectedAudioTracks.length === 0) {
      return audioLabel;
    }

    if (selectedAudioTracks.length === 1) {
      const track = selectedAudioTracks[0];
      const version = this.detectAudioVersion(track);
      return `${audioLabel}.${version}`;
    }

    // Plusieurs pistes audio
    const versions = selectedAudioTracks
      .map((track) => this.detectAudioVersion(track))
      .filter((version, index, arr) => arr.indexOf(version) === index) // Dédupliquer
      .join("+");

    return `${audioLabel}.MULTI.${versions}`;
  }

  /**
   * Détecte la version linguistique d'une piste audio
   */
  private detectAudioVersion(track: AudioTrack): string {
    // Analyser le titre de la piste en premier
    if (track.title) {
      const title = track.title.toLowerCase();

      // Détecter les versions françaises
      if (
        title.includes("vf") ||
        title.includes("version française") ||
        title.includes("french")
      ) {
        return "VF";
      }
      if (
        title.includes("vf2") ||
        title.includes("version française 2") ||
        title.includes("french 2")
      ) {
        return "VF2";
      }
      if (
        title.includes("vff") ||
        title.includes("version française forcée") ||
        title.includes("french forced")
      ) {
        return "VFF";
      }

      // Détecter les versions originales
      if (
        title.includes("vo") ||
        title.includes("version originale") ||
        title.includes("original")
      ) {
        return "VO";
      }
      if (
        title.includes("vost") ||
        title.includes("version originale sous-titrée") ||
        title.includes("original subtitled")
      ) {
        return "VOST";
      }
      if (
        title.includes("vostfr") ||
        title.includes("version originale sous-titrée français") ||
        title.includes("original french subtitled")
      ) {
        return "VOSTFR";
      }

      // Détecter les versions anglaises
      if (
        title.includes("va") ||
        title.includes("version anglaise") ||
        title.includes("english")
      ) {
        return "VA";
      }
      if (
        title.includes("va2") ||
        title.includes("version anglaise 2") ||
        title.includes("english 2")
      ) {
        return "VA2";
      }

      // Détecter les versions internationales
      if (
        title.includes("vi") ||
        title.includes("version internationale") ||
        title.includes("international")
      ) {
        return "VI";
      }

      // Détecter les versions director's cut
      if (
        title.includes("dc") ||
        title.includes("director") ||
        title.includes("director's cut")
      ) {
        return "DC";
      }

      // Détecter les versions extended
      if (title.includes("extended") || title.includes("director's cut")) {
        return "EXT";
      }

      // Détecter les versions unrated
      if (title.includes("unrated") || title.includes("uncut")) {
        return "UNR";
      }

      // Détecter les versions theatrical
      if (title.includes("theatrical") || title.includes("cinema")) {
        return "THE";
      }

      // Détecter les versions commentary
      if (title.includes("commentary") || title.includes("commentaire")) {
        return "COM";
      }

      // Détecter les versions descriptive
      if (
        title.includes("descriptive") ||
        title.includes("audio description")
      ) {
        return "AD";
      }
    }

    // Analyser la langue si le titre ne donne rien
    if (track.language) {
      const language = track.language.toLowerCase();

      // Mapper les codes de langue vers les versions
      switch (language) {
        case "fra":
        case "fre":
        case "fr":
        case "french":
          return "VF";
        case "eng":
        case "en":
        case "english":
          return "VO";
        case "spa":
        case "es":
        case "spanish":
          return "VS";
        case "deu":
        case "ger":
        case "de":
        case "german":
          return "VA";
        case "ita":
        case "it":
        case "italian":
          return "VI";
        case "jpn":
        case "ja":
        case "japanese":
          return "VJ";
        case "kor":
        case "ko":
        case "korean":
          return "VK";
        case "rus":
        case "ru":
        case "russian":
          return "VR";
        case "por":
        case "pt":
        case "portuguese":
          return "VP";
        case "nld":
        case "nl":
        case "dutch":
          return "VN";
        default:
          return language.toUpperCase();
      }
    }

    // Fallback si aucune information n'est disponible
    return "UNK";
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
