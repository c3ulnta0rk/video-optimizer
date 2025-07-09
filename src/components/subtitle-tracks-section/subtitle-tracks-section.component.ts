import { Component, input, output, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatChipsModule } from "@angular/material/chips";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { SubtitleTrack } from "../../services/files-manager.service";

@Component({
  selector: "app-subtitle-tracks-section",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatChipsModule,
    MatCheckboxModule,
  ],
  templateUrl: "./subtitle-tracks-section.component.html",
  styleUrls: ["./subtitle-tracks-section.component.scss"],
})
export class SubtitleTracksSectionComponent {
  subtitleTracks = input<SubtitleTrack[]>([]);
  selectedTracks = input<Set<number>>(new Set());
  tracksChanged = output<Set<number>>();

  public subtitleSectionExpanded = signal(false);

  toggleSubtitleSection(): void {
    this.subtitleSectionExpanded.update((expanded) => !expanded);
  }

  getSelectedSubtitleTracksCount(): number {
    return this.selectedTracks().size;
  }

  isSubtitleTrackSelected(index: number): boolean {
    return this.selectedTracks().has(index);
  }

  toggleSubtitleTrack(index: number, checked: boolean): void {
    const newSelection = new Set(this.selectedTracks());
    if (checked) {
      newSelection.add(index);
    } else {
      newSelection.delete(index);
    }
    this.tracksChanged.emit(newSelection);
  }

  areAllSubtitleTracksSelected(): boolean {
    return (
      this.subtitleTracks().length > 0 &&
      this.selectedTracks().size === this.subtitleTracks().length
    );
  }

  areSomeSubtitleTracksSelected(): boolean {
    return (
      this.selectedTracks().size > 0 &&
      this.selectedTracks().size < this.subtitleTracks().length
    );
  }

  toggleAllSubtitleTracks(checked: boolean): void {
    const newSelection = new Set<number>();
    if (checked) {
      this.subtitleTracks().forEach((track) => newSelection.add(track.index));
    }
    this.tracksChanged.emit(newSelection);
  }
}
