import { Component, OnInit, output, signal } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

@Component({
  selector: "app-advanced-appbar",
  templateUrl: "./advanced-appbar.component.html",
  styleUrls: ["./advanced-appbar.component.scss"],
})
export class AdvancedAppbarComponent implements OnInit {
  public readonly settingsClicked = output<void>();
  public readonly filesSelected = output<void>();

  public readonly isMaximized = signal(false);
  public readonly isMenuOpen = signal(false);

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
    await invoke("close_window");
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
}
