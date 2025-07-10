import { inject, Injectable, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { SettingsService } from "./settings.service";
import { Observable, of, throwError } from "rxjs";
import { map, catchError } from "rxjs/operators";

export interface MovieInfo {
  title: string;
  year?: number;
  type: "movie" | "tv";
  tmdbId?: number;
  posterPath?: string;
  overview?: string;
  confidence: number; // 0-1, confiance dans l'extraction
  backdropPath?: string;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  releaseDate?: string;
  genres?: string[];
}

export interface ParsedTitle {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  quality?: string;
  group?: string;
  originalName: string;
}

export interface MovieSearchResult {
  selected: MovieInfo;
  alternatives: MovieInfo[];
  originalQuery: string;
}

@Injectable({
  providedIn: "root",
})
export class MovieTitleParserService {
  private readonly TMDB_BASE_URL = signal("https://api.themoviedb.org/3");

  // Patterns courants pour les noms de fichiers
  private readonly TITLE_PATTERNS = signal([
    // Pattern: Movie.Name.2023.1080p.BluRay.x264-GROUP
    /^(.+?)\.(\d{4})\.(.+?)-(.+?)$/i,
    // Pattern: Movie Name (2023) 1080p BluRay x264-GROUP
    /^(.+?)\s*\((\d{4})\)\s*(.+?)-(.+?)$/i,
    // Pattern: Movie.Name.2023.1080p.BluRay.x264
    /^(.+?)\.(\d{4})\.(.+?)$/i,
    // Pattern: Movie Name 2023 1080p BluRay x264
    /^(.+?)\s+(\d{4})\s+(.+?)$/i,
    // Pattern: Movie.Name.S01E01.1080p.BluRay.x264-GROUP
    /^(.+?)\.S(\d{2})E(\d{2})\.(.+?)-(.+?)$/i,
    // Pattern: Movie Name S01E01 1080p BluRay x264-GROUP
    /^(.+?)\s+S(\d{2})E(\d{2})\s+(.+?)-(.+?)$/i,
    // Pattern: Movie.Name.S01E01.1080p.BluRay.x264
    /^(.+?)\.S(\d{2})E(\d{2})\.(.+?)$/i,
    // Pattern: Movie Name S01E01 1080p BluRay x264
    /^(.+?)\s+S(\d{2})E(\d{2})\s+(.+?)$/i,
    // Pattern simple: Movie.Name.2023
    /^(.+?)\.(\d{4})$/i,
    // Pattern simple: Movie Name (2023)
    /^(.+?)\s*\((\d{4})\)$/i,
    // Pattern simple: Movie.Name
    /^(.+?)$/i,
  ]);
  private readonly http = inject(HttpClient);
  private readonly settingsService = inject(SettingsService);

  /**
   * Extrait le titre du film/série à partir du nom de fichier
   */
  public parseMovieTitle(fileName: string): Observable<MovieInfo> {
    // Nettoyer le nom de fichier
    const cleanFileName = this.cleanFileName(fileName);

    // Parser le nom de fichier
    const parsed = this.parseFileName(cleanFileName);

    if (!parsed.title) {
      return of({
        title: cleanFileName,
        type: "movie",
        confidence: 0.1,
      });
    }

    // Essayer de trouver le film/série sur TMDB
    return this.searchOnTMDB(parsed).pipe(
      map((result) => ({
        ...result,
        confidence: Math.min(result.confidence + 0.3, 1.0), // Bonus pour la validation TMDB
      })),
      catchError(() => {
        // Si TMDB échoue, retourner le titre parsé
        const fallbackType: "movie" | "tv" = parsed.season ? "tv" : "movie";
        return of({
          title: parsed.title,
          year: parsed.year,
          type: fallbackType as "movie" | "tv",
          confidence: 0.6,
        });
      })
    );
  }

  /**
   * Nettoie le nom de fichier
   */
  private cleanFileName(fileName: string): string {
    return fileName
      .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i, "") // Supprimer l'extension
      .replace(/\./g, " ") // Remplacer les points par des espaces
      .replace(/\s+/g, " ") // Normaliser les espaces
      .trim();
  }

  /**
   * Parse le nom de fichier selon les patterns courants
   */
  private parseFileName(fileName: string): ParsedTitle {
    for (const pattern of this.TITLE_PATTERNS()) {
      const match = fileName.match(pattern);
      if (match) {
        const groups = match.slice(1);

        if (groups.length >= 2) {
          // Pattern avec année
          if (groups[1] && /^\d{4}$/.test(groups[1])) {
            return {
              title: this.cleanTitle(groups[0]),
              year: parseInt(groups[1]),
              quality: groups[2] || undefined,
              group: groups[3] || undefined,
              originalName: fileName,
            };
          }

          // Pattern avec saison/épisode
          if (
            groups[1] &&
            groups[2] &&
            /^\d{2}$/.test(groups[1]) &&
            /^\d{2}$/.test(groups[2])
          ) {
            return {
              title: this.cleanTitle(groups[0]),
              season: parseInt(groups[1]),
              episode: parseInt(groups[2]),
              quality: groups[3] || undefined,
              group: groups[4] || undefined,
              originalName: fileName,
            };
          }
        }

        // Pattern simple
        return {
          title: this.cleanTitle(groups[0]),
          originalName: fileName,
        };
      }
    }

    // Fallback
    return {
      title: fileName,
      originalName: fileName,
    };
  }

  /**
   * Nettoie le titre extrait
   */
  private cleanTitle(title: string): string {
    return title
      .replace(/[._-]/g, " ") // Remplacer les séparateurs par des espaces
      .replace(/\s+/g, " ") // Normaliser les espaces
      .replace(/^\s+|\s+$/g, "") // Supprimer les espaces en début/fin
      .replace(
        /\b(1080p|720p|480p|4K|HDRip|BRRip|BluRay|DVD|WEB-DL|HDTV|PDTV|CAM|TS|TC|R5|R6)\b/gi,
        ""
      ) // Supprimer les qualités
      .replace(/\b(x264|x265|XviD|DivX|AAC|AC3|DTS|MP3)\b/gi, "") // Supprimer les codecs
      .replace(/\s+/g, " ") // Normaliser à nouveau les espaces
      .trim();
  }

  /**
   * Recherche le film/série sur TMDB
   */
  private searchOnTMDB(parsed: ParsedTitle): Observable<MovieInfo> {
    const apiKey = this.settingsService.getTmdbApiKey();
    if (!apiKey) {
      return throwError(() => new Error("Clé API TMDB non configurée"));
    }

    const searchType = parsed.season ? "tv" : "movie";
    const searchUrl = `${this.TMDB_BASE_URL()}/search/${searchType}`;

    const params: any = {
      api_key: apiKey,
      query: parsed.title,
      language: "fr-FR",
    };

    if (parsed.year) {
      params.year = parsed.year;
    }

    return this.http.get<any>(searchUrl, { params }).pipe(
      map((response) => {
        if (response.results && response.results.length > 0) {
          const bestMatch = response.results[0];
          return {
            title: bestMatch.title || bestMatch.name,
            year:
              parsed.year ||
              this.extractYearFromDate(
                bestMatch.release_date || bestMatch.first_air_date
              ),
            type: searchType as "movie" | "tv",
            tmdbId: bestMatch.id,
            posterPath: bestMatch.poster_path,
            overview: bestMatch.overview,
            confidence: 0.8,
          };
        }

        return {
          title: parsed.title,
          year: parsed.year,
          type: searchType as "movie" | "tv",
          confidence: 0.5,
        };
      })
    );
  }

  /**
   * Extrait l'année depuis une date
   */
  private extractYearFromDate(dateString?: string): number | undefined {
    if (!dateString) return undefined;
    const year = parseInt(dateString.split("-")[0]);
    return isNaN(year) ? undefined : year;
  }

  /**
   * Obtient les détails complets d'un film/série depuis TMDB
   */
  public getMovieDetails(
    tmdbId: number,
    type: "movie" | "tv"
  ): Observable<any> {
    const apiKey = this.settingsService.getTmdbApiKey();
    if (!apiKey) {
      return throwError(() => new Error("Clé API TMDB non configurée"));
    }

    const url = `${this.TMDB_BASE_URL()}/${type}/${tmdbId}`;
    const params = {
      api_key: apiKey,
      language: "fr-FR",
      append_to_response: "credits,videos,images",
    };

    return this.http.get(url, { params });
  }

  /**
   * Recherche le film/série sur TMDB avec alternatives
   */
  public searchMovieWithAlternatives(
    fileName: string
  ): Observable<MovieSearchResult> {
    const cleanFileName = this.cleanFileName(fileName);
    const parsed = this.parseFileName(cleanFileName);

    if (!parsed.title) {
      return of({
        selected: {
          title: cleanFileName,
          type: "movie",
          confidence: 0.1,
        },
        alternatives: [],
        originalQuery: cleanFileName,
      });
    }

    const apiKey = this.settingsService.getTmdbApiKey();
    if (!apiKey) {
      return of({
        selected: {
          title: parsed.title,
          year: parsed.year,
          type: (parsed.season ? "tv" : "movie") as "movie" | "tv",
          confidence: 0.6,
        },
        alternatives: [],
        originalQuery: parsed.title,
      });
    }

    const searchType = parsed.season ? "tv" : "movie";
    const searchUrl = `${this.TMDB_BASE_URL()}/search/${searchType}`;

    const params: any = {
      api_key: apiKey,
      query: parsed.title,
      language: "fr-FR",
      page: 1,
      include_adult: false,
    };

    if (parsed.year) {
      params.year = parsed.year;
    }

    return this.http.get<any>(searchUrl, { params }).pipe(
      map((response) => {
        if (response.results && response.results.length > 0) {
          const alternatives = response.results
            .slice(0, 10)
            .map((result: any) => ({
              title: result.title || result.name,
              year:
                parsed.year ||
                this.extractYearFromDate(
                  result.release_date || result.first_air_date
                ),
              type: searchType as "movie" | "tv",
              tmdbId: result.id,
              posterPath: result.poster_path,
              backdropPath: result.backdrop_path,
              overview: result.overview,
              voteAverage: result.vote_average,
              voteCount: result.vote_count,
              popularity: result.popularity,
              releaseDate: result.release_date || result.first_air_date,
              confidence: 0.8,
            }));

          // Sélectionner le plus populaire par défaut
          const selected = alternatives.reduce(
            (best: MovieInfo, current: MovieInfo) =>
              (current.popularity || 0) > (best.popularity || 0)
                ? current
                : best
          );

          return {
            selected,
            alternatives,
            originalQuery: parsed.title,
          };
        }

        return {
          selected: {
            title: parsed.title,
            year: parsed.year,
            type: (parsed.season ? "tv" : "movie") as "movie" | "tv",
            confidence: 0.5,
          },
          alternatives: [],
          originalQuery: parsed.title,
        };
      }),
      catchError(() => {
        return of({
          selected: {
            title: parsed.title,
            year: parsed.year,
            type: (parsed.season ? "tv" : "movie") as "movie" | "tv",
            confidence: 0.6,
          },
          alternatives: [],
          originalQuery: parsed.title,
        });
      })
    );
  }

  /**
   * Recherche manuelle avec des mots-clés personnalisés
   */
  public searchMovieWithCustomKeywords(
    customQuery: string,
    searchType: "movie" | "tv" = "movie",
    year?: number
  ): Observable<MovieSearchResult> {
    const apiKey = this.settingsService.getTmdbApiKey();
    if (!apiKey) {
      return of({
        selected: {
          title: customQuery,
          year,
          type: searchType,
          confidence: 0.6,
        },
        alternatives: [],
        originalQuery: customQuery,
      });
    }

    const searchUrl = `${this.TMDB_BASE_URL()}/search/${searchType}`;

    const params: any = {
      api_key: apiKey,
      query: customQuery,
      language: "fr-FR",
      page: 1,
      include_adult: false,
    };

    if (year) {
      params.year = year;
    }

    return this.http.get<any>(searchUrl, { params }).pipe(
      map((response) => {
        if (response.results && response.results.length > 0) {
          const alternatives = response.results
            .slice(0, 10)
            .map((result: any) => ({
              title: result.title || result.name,
              year:
                year ||
                this.extractYearFromDate(
                  result.release_date || result.first_air_date
                ),
              type: searchType,
              tmdbId: result.id,
              posterPath: result.poster_path,
              backdropPath: result.backdrop_path,
              overview: result.overview,
              voteAverage: result.vote_average,
              voteCount: result.vote_count,
              popularity: result.popularity,
              releaseDate: result.release_date || result.first_air_date,
              confidence: 0.8,
            }));

          // Sélectionner le plus populaire par défaut
          const selected = alternatives.reduce(
            (best: MovieInfo, current: MovieInfo) =>
              (current.popularity || 0) > (best.popularity || 0)
                ? current
                : best
          );

          return {
            selected,
            alternatives,
            originalQuery: customQuery,
          };
        }

        return {
          selected: {
            title: customQuery,
            year,
            type: searchType,
            confidence: 0.5,
          },
          alternatives: [],
          originalQuery: customQuery,
        };
      }),
      catchError(() => {
        return of({
          selected: {
            title: customQuery,
            year,
            type: searchType,
            confidence: 0.6,
          },
          alternatives: [],
          originalQuery: customQuery,
        });
      })
    );
  }
}
