import { Injectable, signal } from "@angular/core";
import { VideoFile, AudioTrack } from "./files-manager.service";
import {
  OutputFileConfig,
  GeneratedFilename,
  FilenameGeneratorService,
} from "./filename-generator.service";
import { MovieMetadata } from "./conversion.service";

export interface VideoConfiguration {
  videoPath: string;
  config: OutputFileConfig;
  selectedAudioTracks: number[];
  selectedSubtitleTracks: number[];
  generatedFilename: GeneratedFilename | null;
  customOutputPath: string | null;
  movieMetadata: MovieMetadata | undefined;
}

@Injectable({
  providedIn: "root",
})
export class VideoConfigService {
  private readonly _videoConfigs = signal<Map<string, VideoConfiguration>>(
    new Map()
  );

  constructor(private filenameGenerator: FilenameGeneratorService) {}

  /**
   * Sauvegarde la configuration d'une vidéo
   */
  saveVideoConfig(
    videoPath: string,
    config: OutputFileConfig,
    selectedAudioTracks: number[],
    selectedSubtitleTracks: number[],
    generatedFilename: GeneratedFilename | null,
    customOutputPath: string | null,
    movieMetadata: MovieMetadata | undefined
  ): void {
    const videoConfig: VideoConfiguration = {
      videoPath,
      config,
      selectedAudioTracks,
      selectedSubtitleTracks,
      generatedFilename,
      customOutputPath,
      movieMetadata,
    };

    this._videoConfigs.update((configs) => {
      const newConfigs = new Map(configs);
      newConfigs.set(videoPath, videoConfig);
      return newConfigs;
    });
  }

  /**
   * Récupère la configuration d'une vidéo
   */
  getVideoConfig(videoPath: string): VideoConfiguration | null {
    return this._videoConfigs().get(videoPath) || null;
  }

  /**
   * Supprime la configuration d'une vidéo
   */
  removeVideoConfig(videoPath: string): void {
    this._videoConfigs.update((configs) => {
      const newConfigs = new Map(configs);
      newConfigs.delete(videoPath);
      return newConfigs;
    });
  }

  /**
   * Génère une configuration par défaut pour une vidéo
   */
  generateDefaultConfig(video: VideoFile): VideoConfiguration {
    const config: OutputFileConfig = {
      format: "mkv",
      quality: "1080p",
      codec: "h265",
      audio: "aac",
      crf: 20,
      group: "VideoOptimizer",
    };

    // Générer le nom de fichier
    let generatedFilename: GeneratedFilename | null = null;
    let movieMetadata: MovieMetadata | undefined = undefined;

    if (video.movieInfo) {
      generatedFilename = this.filenameGenerator.generateOutputFilename(
        video.movieInfo,
        video.path,
        config
      );

      movieMetadata = {
        title: video.movieInfo.title,
        year: video.movieInfo.releaseDate
          ? new Date(video.movieInfo.releaseDate).getFullYear()
          : video.movieInfo.year,
        overview: video.movieInfo.overview,
        director: undefined,
        cast: [],
        genre: video.movieInfo.genres || [],
        rating: video.movieInfo.voteAverage,
        poster_path: video.movieInfo.posterPath,
      };
    }

    return {
      videoPath: video.path,
      config,
      selectedAudioTracks:
        video.audio_tracks?.map((track) => track.index) || [],
      selectedSubtitleTracks:
        video.subtitle_tracks?.map((track) => track.index) || [],
      generatedFilename,
      customOutputPath: null,
      movieMetadata,
    };
  }

  /**
   * Obtient ou génère une configuration pour une vidéo
   */
  getOrCreateVideoConfig(video: VideoFile): VideoConfiguration {
    const existingConfig = this.getVideoConfig(video.path);
    if (existingConfig) {
      return existingConfig;
    }

    // Générer une configuration par défaut
    const defaultConfig = this.generateDefaultConfig(video);
    this.saveVideoConfig(
      video.path,
      defaultConfig.config,
      defaultConfig.selectedAudioTracks,
      defaultConfig.selectedSubtitleTracks,
      defaultConfig.generatedFilename,
      defaultConfig.customOutputPath,
      defaultConfig.movieMetadata
    );

    return defaultConfig;
  }
}
