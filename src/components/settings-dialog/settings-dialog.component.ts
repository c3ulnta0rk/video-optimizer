import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { SettingsService, AppSettings } from "../../services/settings.service";
import { DirectorySelectorService } from "../../services/directory-selector.service";

@Component({
  selector: "app-settings-dialog",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: "./settings-dialog.component.html",
  styleUrls: ["./settings-dialog.component.scss"],
})
export class SettingsDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<SettingsDialogComponent>);
  private settingsService = inject(SettingsService);
  private directorySelector = inject(DirectorySelectorService);

  public readonly settings = signal<AppSettings>({
    tmdbApiKey: "",
    theme: "auto",
    videoConfig: {
      format: "mkv",
      quality: "1080p",
      codec: "h265",
      audio: "aac",
      crf: 20,
      group: "VideoOptimizer",
    },
    defaultOutputPath: null,
  });

  ngOnInit(): void {
    this.settings.set({ ...this.settingsService.getSettings() });
  }

  async onSave(): Promise<void> {
    await this.settingsService.updateSettings(this.settings());
    this.dialogRef.close(this.settings());
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  async onReset(): Promise<void> {
    this.settings.set({
      tmdbApiKey: "",
      theme: "auto",
      videoConfig: {
        format: "mkv",
        quality: "1080p",
        codec: "h265",
        audio: "aac",
        crf: 20,
        group: "VideoOptimizer",
      },
      defaultOutputPath: null,
    });
    await this.settingsService.updateSettings(this.settings());
  }

  async selectDefaultOutputPath(): Promise<void> {
    const selectedPath = await this.directorySelector.selectDirectory();
    if (selectedPath !== null) {
      this.settings.update((settings) => ({
        ...settings,
        defaultOutputPath: selectedPath,
      }));
    }
  }
}
