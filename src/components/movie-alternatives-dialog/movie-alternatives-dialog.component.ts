import { Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from "@angular/material/dialog";
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatChipsModule } from "@angular/material/chips";
import {
  MovieInfo,
  MovieSearchResult,
} from "../../services/movie-title-parser.service";

@Component({
  selector: "app-movie-alternatives-dialog",
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  templateUrl: "./movie-alternatives-dialog.component.html",
  styleUrls: ["./movie-alternatives-dialog.component.scss"],
})
export class MovieAlternativesDialogComponent {
  private dialogRef = inject(MatDialogRef<MovieAlternativesDialogComponent>);
  private data = inject(MAT_DIALOG_DATA);

  public readonly movieResults = signal<MovieSearchResult>(
    this.data.movieResults
  );
  public readonly selectedMovie = signal<MovieInfo>(
    this.data.movieResults.selected
  );

  onSelectMovie(movie: MovieInfo): void {
    this.selectedMovie.set(movie);
  }

  onConfirm(): void {
    this.dialogRef.close(this.selectedMovie);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getPosterUrl(posterPath: string | undefined): string {
    if (!posterPath) return "assets/no-poster.png";
    return `https://image.tmdb.org/t/p/w200${posterPath}`;
  }

  getBackdropUrl(backdropPath: string | undefined): string {
    if (!backdropPath) return "assets/no-backdrop.png";
    return `https://image.tmdb.org/t/p/original${backdropPath}`;
  }

  formatYear(releaseDate?: string): string {
    if (!releaseDate) return "";
    return new Date(releaseDate).getFullYear().toString();
  }
}
