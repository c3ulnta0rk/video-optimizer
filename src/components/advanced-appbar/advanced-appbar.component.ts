import { Component, OnInit, output, signal } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { TrayService } from "../../services/tray.service";
import { FilesSelectorComponent } from "../files-selector/files-selector.component";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";

@Component({
  selector: "app-advanced-appbar",
  templateUrl: "./advanced-appbar.component.html",
  styleUrls: ["./advanced-appbar.component.scss"],
  imports: [
    FilesSelectorComponent,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
})
export class AdvancedAppbarComponent implements OnInit {
  public readonly settingsClicked = output<void>();
  public readonly filesSelected = output<void>();
  public readonly toggleTheme = output<void>();

  public readonly isMaximized = signal(false);
  public readonly isMenuOpen = signal(false);

  constructor(private trayService: TrayService) {}

  ngOnInit(): void {
    this.checkWindowState();
  }

  async minimizeWindow(): Promise<void> {
    await invoke("minimize_window");
  }

  async maximizeWindow(): Promise<void> {
    await invoke("maximize_window");
    this.isMaximized.set(!this.isMaximized());
  }

  async closeWindow(): Promise<void> {
    await this.trayService.hideToTray();
  }

  private async checkWindowState(): Promise<void> {
    try {
      this.isMaximized.set(await invoke("is_maximized"));
    } catch (error) {
      console.error(
        "Erreur lors de la vérification de l'état de la fenêtre:",
        error
      );
    }
  }

  onMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      invoke("start_dragging");
    }
  }

  toggleMenu(): void {
    this.isMenuOpen.set(!this.isMenuOpen());
  }

  onSettingsClick(): void {
    this.settingsClicked.emit();
  }

  onFilesSelect(): void {
    this.filesSelected.emit();
  }

  onToggleTheme(): void {
    this.toggleTheme.emit();
  }
}
