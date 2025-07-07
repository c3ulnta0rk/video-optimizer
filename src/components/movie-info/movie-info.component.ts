import { Component, Input, inject, output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatChipsModule } from "@angular/material/chips";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MovieInfo } from "../../services/movie-title-parser.service";

@Component({
  selector: "app-movie-info",
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatChipsModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: "./movie-info.component.html",
  styleUrls: ["./movie-info.component.scss"],
})
export class MovieInfoComponent {
  @Input() movieInfo: MovieInfo | undefined;
  @Input() showAlternativesButton: boolean = false;

  public readonly openAlternatives = output<void>();

  onOpenAlternatives(event: Event): void {
    event.stopPropagation();
    this.openAlternatives.emit();
  }

  getPosterUrl(posterPath: string | undefined): string {
    if (!posterPath) return "assets/no-poster.png";
    return `https://image.tmdb.org/t/p/w200${posterPath}`;
  }

  formatDate(dateString?: string): string {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return "high-confidence";
    if (confidence >= 0.6) return "medium-confidence";
    return "low-confidence";
  }
}
