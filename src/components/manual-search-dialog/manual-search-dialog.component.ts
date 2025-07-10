import { Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from "@angular/material/dialog";
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatChipsModule } from "@angular/material/chips";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import {
  MovieInfo,
  MovieSearchResult,
  MovieTitleParserService,
} from "../../services/movie-title-parser.service";
import { firstValueFrom } from "rxjs";

export interface ManualSearchData {
  originalFileName: string;
  originalQuery: string;
}

@Component({
  selector: "app-manual-search-dialog",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: "./manual-search-dialog.component.html",
  styleUrls: ["./manual-search-dialog.component.scss"],
})
export class ManualSearchDialogComponent {
  private dialogRef = inject(MatDialogRef<ManualSearchDialogComponent>);
  private data = inject(MAT_DIALOG_DATA);
  private movieParser = inject(MovieTitleParserService);

  public readonly originalFileName = signal<string>(this.data.originalFileName);
  public readonly originalQuery = signal<string>(this.data.originalQuery);

  public readonly searchQuery = signal<string>("");
  public readonly searchType = signal<"movie" | "tv">("movie");
  public readonly searchYear = signal<number | undefined>(undefined);
  public readonly isLoading = signal<boolean>(false);
  public readonly searchResults = signal<MovieSearchResult | null>(null);
  public readonly selectedMovie = signal<MovieInfo | null>(null);

  constructor() {
    // Initialiser avec la requête originale
    this.searchQuery.set(this.originalQuery());
  }

  async onSearch(): Promise<void> {
    if (!this.searchQuery().trim()) return;

    this.isLoading.set(true);
    this.searchResults.set(null);
    this.selectedMovie.set(null);

    try {
      const results = await firstValueFrom(
        this.movieParser.searchMovieWithCustomKeywords(
          this.searchQuery(),
          this.searchType(),
          this.searchYear()
        )
      );

      this.searchResults.set(results);
      this.selectedMovie.set(results.selected);
    } catch (error) {
      console.error("Erreur lors de la recherche:", error);
    } finally {
      this.isLoading.set(false);
    }
  }

  onSelectMovie(movie: MovieInfo): void {
    this.selectedMovie.set(movie);
  }

  onConfirm(): void {
    if (this.selectedMovie()) {
      this.dialogRef.close(this.selectedMovie());
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getPosterUrl(posterPath: string | undefined): string {
    if (!posterPath) return "assets/no-poster.png";
    return `https://image.tmdb.org/t/p/w200${posterPath}`;
  }

  formatYear(releaseDate?: string): string {
    if (!releaseDate) return "";
    return new Date(releaseDate).getFullYear().toString();
  }

  // Suggestions de mots-clés basées sur le nom de fichier original
  getSuggestedKeywords(): string[] {
    const fileName = this.originalFileName();
    const suggestions: string[] = [];

    // Extraire le titre de base (avant les mots comme REMASTERED, MULTI, etc.)
    const baseTitle = fileName
      .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i, "")
      .replace(/\./g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Supprimer les mots problématiques
    const cleanTitle = baseTitle
      .replace(
        /\b(REMASTERED|MULTI|EXTENDED|DIRECTOR|CUT|UNRATED|RETAIL|PROPER|REPACK|INTERNAL|FINAL|REAL|READNFO|NFOFIX|SUBFIX|AUDIOFIX|DUAL|MULTI|AC3|DTS|AAC|MP3|X264|X265|XVID|DIVX|BLURAY|DVDRIP|HDRIP|BRRIP|WEBRIP|WEB-DL|HDTV|PDTV|CAM|TS|TC|R5|R6|1080P|720P|480P|4K|HDR|SDR|10BIT|8BIT)\b/gi,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();

    if (cleanTitle && cleanTitle !== baseTitle) {
      suggestions.push(cleanTitle);
    }

    // Ajouter des variations
    if (cleanTitle) {
      // Version avec espaces au lieu de points
      suggestions.push(cleanTitle.replace(/[._-]/g, " "));

      // Version avec seulement les premiers mots (titre principal)
      const words = cleanTitle.split(" ");
      if (words.length > 2) {
        suggestions.push(words.slice(0, 2).join(" "));
      }
    }

    return suggestions.filter((s, i, arr) => arr.indexOf(s) === i); // Supprimer les doublons
  }

  onUseSuggestion(suggestion: string): void {
    this.searchQuery.set(suggestion);
    this.onSearch();
  }
}
