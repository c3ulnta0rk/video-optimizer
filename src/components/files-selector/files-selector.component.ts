import { Component, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatTooltipModule } from "@angular/material/tooltip";
import { FilesManagerService } from "../../services/files-manager.service";

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
  public readonly directory = this.filesManager.directory;

  constructor(private filesManager: FilesManagerService) {}

  async onAddFiles() {
    await this.filesManager.selectFiles();
  }

  onToggleDirectory(checked?: boolean) {
    this.filesManager.toggleDirectoryMode(checked);
  }
}
