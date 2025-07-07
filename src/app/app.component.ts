import { Component, OnInit, signal, ViewEncapsulation } from "@angular/core";

import { getCurrentWindow } from "@tauri-apps/api/window";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { FilesSelectorComponent } from "../components/files-selector/files-selector.component";
import {
  VideosTableComponent,
  VideoFile,
} from "../components/videos-table/videos-table.component";

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
  public readonly videosPaths = signal<string[]>([]);
  public readonly selectedVideo = signal<VideoFile | null>(null);

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
    this.selectedVideo.set(video);
    console.log("Vidéo sélectionnée:", video);
  }

  public onVideoRemoved(videoPath: string): void {
    const currentPaths = this.videosPaths();
    const updatedPaths = currentPaths.filter((path) => path !== videoPath);
    this.videosPaths.set(updatedPaths);

    // Si la vidéo supprimée était sélectionnée, on désélectionne
    if (this.selectedVideo()?.path === videoPath) {
      this.selectedVideo.set(null);
    }

    console.log("Vidéo supprimée:", videoPath);
  }
}
