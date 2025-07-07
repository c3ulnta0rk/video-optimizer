import { Component, model, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatTooltipModule } from "@angular/material/tooltip";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";

@Component({
  selector: "app-files-selector",
  imports: [
    MatIconModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: "./files-selector.component.html",
  styleUrl: "./files-selector.component.scss",
})
export class FilesSelectorComponent {
  public readonly videosPaths = model<string[]>([]);
  public readonly directory = signal<boolean>(false);

  async onAddFiles() {
    const videosPaths: string[] = [];
    const paths = await open({
      multiple: true,
      directory: this.directory(),
      filters: [{ name: "Videos", extensions: ["mp4", "mov", "avi", "mkv"] }],
    });

    if (!paths?.length) {
      return;
    }

    if (this.directory()) {
      for (const path of paths) {
        const scannedVideosPaths = await this.scanDirectoryRecursively(path);
        videosPaths.push(...scannedVideosPaths);
      }
    } else {
      for (const path of paths) {
        if (
          path.endsWith(".mp4") ||
          path.endsWith(".mov") ||
          path.endsWith(".avi") ||
          path.endsWith(".mkv")
        ) {
          videosPaths.push(path);
        }
      }
    }

    this.videosPaths.set(videosPaths);
  }

  async scanDirectoryRecursively(path: string) {
    const allVideosPaths: string[] = [];
    const files = await readDir(path);
    for (const file of files) {
      if (file.isDirectory) {
        const newPath = `${path}/${file.name}`;
        const newVideosPaths = await this.scanDirectoryRecursively(newPath);
        allVideosPaths.push(...newVideosPaths);
      } else if (
        file.isFile &&
        (file.name.endsWith(".mp4") ||
          file.name.endsWith(".mov") ||
          file.name.endsWith(".avi") ||
          file.name.endsWith(".mkv"))
      ) {
        const fullPath = `${path}/${file.name}`;
        allVideosPaths.push(fullPath);
      }
    }

    return allVideosPaths;
  }
}
