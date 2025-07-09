import { Component, input, output, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatChipsModule } from "@angular/material/chips";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { AudioTrack } from "../../services/files-manager.service";

@Component({
  selector: "app-audio-tracks-section",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatChipsModule,
    MatCheckboxModule,
  ],
  templateUrl: "./audio-tracks-section.component.html",
  styleUrls: ["./audio-tracks-section.component.scss"],
})
export class AudioTracksSectionComponent {
  audioTracks = input<AudioTrack[]>([]);
  selectedTracks = input<Set<number>>(new Set());
  tracksChanged = output<Set<number>>();

  public audioSectionExpanded = signal(false);

  toggleAudioSection(): void {
    this.audioSectionExpanded.update((expanded) => !expanded);
  }

  getSelectedAudioTracksCount(): number {
    return this.selectedTracks().size;
  }

  isAudioTrackSelected(index: number): boolean {
    return this.selectedTracks().has(index);
  }

  toggleAudioTrack(index: number, checked: boolean): void {
    const newSelection = new Set(this.selectedTracks());
    if (checked) {
      newSelection.add(index);
    } else {
      newSelection.delete(index);
    }
    this.tracksChanged.emit(newSelection);
  }

  areAllAudioTracksSelected(): boolean {
    return (
      this.audioTracks().length > 0 &&
      this.selectedTracks().size === this.audioTracks().length
    );
  }

  areSomeAudioTracksSelected(): boolean {
    return (
      this.selectedTracks().size > 0 &&
      this.selectedTracks().size < this.audioTracks().length
    );
  }

  toggleAllAudioTracks(checked: boolean): void {
    const newSelection = new Set<number>();
    if (checked) {
      this.audioTracks().forEach((track) => newSelection.add(track.index));
    }
    this.tracksChanged.emit(newSelection);
  }
}
