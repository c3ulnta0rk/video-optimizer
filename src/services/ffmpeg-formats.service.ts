import { Injectable, signal } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

export interface FfmpegFormat {
  name: string;
  description: string;
  extensions: string[];
}

export interface FfmpegInfo {
  available: boolean;
  formats: FfmpegFormat[];
  loading: boolean;
  error?: string;
}

@Injectable({
  providedIn: "root",
})
export class FfmpegFormatsService {
  private readonly _ffmpegInfo = signal<FfmpegInfo>({
    available: false,
    formats: [],
    loading: false,
  });

  public readonly ffmpegInfo = this._ffmpegInfo.asReadonly();

  constructor() {
    this.checkFfmpegAvailability();
  }

  /**
   * Vérifie si FFmpeg est disponible et récupère les formats supportés
   */
  public async checkFfmpegAvailability(): Promise<void> {
    this._ffmpegInfo.update((info) => ({
      ...info,
      loading: true,
      error: undefined,
    }));

    try {
      const available = await invoke<boolean>("check_ffmpeg_available");

      if (available) {
        const formats = await invoke<FfmpegFormat[]>(
          "get_ffmpeg_output_formats"
        );
        this._ffmpegInfo.set({
          available: true,
          formats: formats || [],
          loading: false,
        });
      } else {
        this._ffmpegInfo.set({
          available: false,
          formats: [],
          loading: false,
          error:
            "FFmpeg n'est pas installé ou n'est pas accessible dans le PATH",
        });
      }
    } catch (error) {
      this._ffmpegInfo.set({
        available: false,
        formats: [],
        loading: false,
        error: `Erreur lors de la vérification de FFmpeg: ${error}`,
      });
    }
  }

  /**
   * Récupère les formats vidéo courants
   */
  public getCommonVideoFormats(): FfmpegFormat[] {
    const commonFormats = [
      "mp4",
      "mov",
      "avi",
      "mkv",
      "webm",
      "flv",
      "wmv",
      "m4v",
    ];
    return this.ffmpegInfo().formats.filter((format) =>
      commonFormats.includes(format.name.toLowerCase())
    );
  }

  /**
   * Récupère les formats par extension
   */
  public getFormatsByExtension(extension: string): FfmpegFormat[] {
    const ext = extension.toLowerCase().replace(".", "");
    return this.ffmpegInfo().formats.filter((format) =>
      format.extensions.some((ext) => ext.toLowerCase() === ext)
    );
  }

  /**
   * Vérifie si un format est supporté
   */
  public isFormatSupported(formatName: string): boolean {
    return this.ffmpegInfo().formats.some(
      (format) => format.name.toLowerCase() === formatName.toLowerCase()
    );
  }

  /**
   * Récupère les extensions supportées pour un format donné
   */
  public getExtensionsForFormat(formatName: string): string[] {
    const format = this.ffmpegInfo().formats.find(
      (f) => f.name.toLowerCase() === formatName.toLowerCase()
    );
    return format?.extensions || [];
  }

  /**
   * Recherche des formats par nom ou description
   */
  public searchFormats(query: string): FfmpegFormat[] {
    const searchTerm = query.toLowerCase();
    return this.ffmpegInfo().formats.filter(
      (format) =>
        format.name.toLowerCase().includes(searchTerm) ||
        format.description.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Récupère les formats de haute qualité (généralement utilisés pour la qualité)
   */
  public getHighQualityFormats(): FfmpegFormat[] {
    const highQualityFormats = ["mp4", "mov", "mkv", "webm"];
    return this.ffmpegInfo().formats.filter((format) =>
      highQualityFormats.includes(format.name.toLowerCase())
    );
  }

  /**
   * Récupère les formats compatibles avec les appareils mobiles
   */
  public getMobileCompatibleFormats(): FfmpegFormat[] {
    const mobileFormats = ["mp4", "3gp", "m4v"];
    return this.ffmpegInfo().formats.filter((format) =>
      mobileFormats.includes(format.name.toLowerCase())
    );
  }

  /**
   * Force le rechargement des formats
   */
  public async refreshFormats(): Promise<void> {
    await this.checkFfmpegAvailability();
  }
}
