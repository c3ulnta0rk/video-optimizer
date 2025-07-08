import { Component, OnInit, signal } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

@Component({
  selector: "app-custom-appbar",
  templateUrl: "./custom-appbar.component.html",
  styleUrls: ["./custom-appbar.component.scss"],
})
export class CustomAppbarComponent implements OnInit {
  public readonly isMaximized = signal(false);

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
    const currentWindow = await getCurrentWindow();
    currentWindow.setDecorations(false);
    currentWindow.setShadow(true);
    currentWindow.setSize(new LogicalSize(600, 500));
  }

  // Gestion du déplacement de la fenêtre
  onMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      invoke("start_dragging");
    }
  }
}
