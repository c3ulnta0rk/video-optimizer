import { Component, OnInit, ViewEncapsulation } from "@angular/core";

import { getCurrentWindow } from "@tauri-apps/api/window";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { FilesSelectorComponent } from "../components/files-selector/files-selector.component";
import { VideosTableComponent } from "../components/videos-table/videos-table.component";
import {
  FilesManagerService,
  VideoFile,
} from "../services/files-manager.service";

@Component({
  selector: "app-root",
  imports: [
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    FilesSelectorComponent,
    VideosTableComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent implements OnInit {
  public readonly selectedVideo = this.filesManager.selectedVideo;

  constructor(private filesManager: FilesManagerService) {}

  ngOnInit(): void {
    // Détection initiale
    this.updateTheme();

    // Écoute des changements
    getCurrentWindow().onThemeChanged((theme) => {
      this.updateTheme();
    });
  }

  private updateTheme() {
    getCurrentWindow()
      .theme()
      .then((theme: "dark" | "light" | null) => {
        if (theme === "dark") {
          window.document.body.classList.add("dark");
          window.document.body.classList.remove("light");
        } else if (theme === "light") {
          window.document.body.classList.remove("dark");
          window.document.body.classList.add("light");
        }
      });
  }

  public onVideoSelected(video: VideoFile): void {
    console.log("Vidéo sélectionnée dans AppComponent:", video);
  }

  public onVideoRemoved(videoPath: string): void {
    console.log("Vidéo supprimée dans AppComponent:", videoPath);
  }
}
