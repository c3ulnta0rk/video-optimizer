import {
  Component,
  computed,
  inject,
  OnInit,
  ViewEncapsulation,
} from "@angular/core";

import { getCurrentWindow } from "@tauri-apps/api/window";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatSnackBarModule } from "@angular/material/snack-bar";
import { VideosTableComponent } from "../components/videos-table/videos-table.component";
import { SettingsDialogComponent } from "../components/settings-dialog/settings-dialog.component";
import { AdvancedAppbarComponent } from "../components/advanced-appbar/advanced-appbar.component";

import {
  FilesManagerService,
  VideoFile,
} from "../services/files-manager.service";
import { SettingsService } from "../services/settings.service";

@Component({
  selector: "app-root",
  imports: [
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    VideosTableComponent,
    AdvancedAppbarComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent implements OnInit {
  private readonly filesManager = inject(FilesManagerService);
  private readonly settingsService = inject(SettingsService);
  private readonly dialog = inject(MatDialog);
  public readonly selectedVideo = computed(
    () => this.filesManager.selectedVideo
  );

  ngOnInit(): void {
    // Détection initiale
    this.updateTheme();

    // Écoute des changements
    getCurrentWindow().onThemeChanged((theme) => {
      this.updateTheme();
    });

    // Écouter les changements de paramètres
    this.settingsService.settings$.subscribe((settings) => {
      if (settings.theme !== "auto") {
        this.applyTheme(settings.theme);
      } else {
        this.updateTheme();
      }
    });
  }

  private updateTheme() {
    const userTheme = this.settingsService.getTheme();
    if (userTheme === "auto") {
      getCurrentWindow()
        .theme()
        .then((theme: "dark" | "light" | null) => {
          this.applyTheme(theme === "dark" ? "dark" : "light");
        });
    } else {
      this.applyTheme(userTheme);
    }
  }

  private applyTheme(theme: "dark" | "light") {
    if (theme === "dark") {
      window.document.body.classList.add("dark");
      window.document.body.classList.remove("light");
    } else {
      window.document.body.classList.remove("dark");
      window.document.body.classList.add("light");
    }
  }

  onSettingsClick() {
    this.openSettings();
  }
  onFilesSelect() {
    this.filesManager.selectFiles();
  }

  onToggleTheme() {
    this.settingsService.toggleTheme();
  }

  onFfmpegFormatsClick() {
    this.openFfmpegFormatsDialog();
  }

  public openSettings(): void {
    const dialogRef = this.dialog.open(SettingsDialogComponent, {
      width: "500px",
      maxWidth: "90vw",
      disableClose: false,
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        console.log("Paramètres mis à jour:", result);
      }
    });
  }

  public openFfmpegFormatsDialog(): void {
    this.filesManager.openFfmpegFormatsDialog().then((selectedFormat) => {
      if (selectedFormat) {
        console.log("Format sélectionné:", selectedFormat);
        // Ici vous pouvez ajouter la logique pour utiliser le format sélectionné
        // Par exemple, l'ajouter aux paramètres de conversion
      }
    });
  }
}
