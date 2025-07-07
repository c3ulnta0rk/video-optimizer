import { Component, OnInit, ViewEncapsulation } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterOutlet } from "@angular/router";
import { getCurrentWindow } from "@tauri-apps/api/window";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent implements OnInit {
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
        if (
          theme === "dark" &&
          !window.document.body.classList.contains("dark")
        ) {
          window.document.body.classList.add("dark");
        } else if (
          theme === "light" &&
          window.document.body.classList.contains("dark")
        ) {
          window.document.body.classList.remove("dark");
        }
      });
  }
}
