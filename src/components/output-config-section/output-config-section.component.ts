import { Component, input, output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import {
  OutputFileConfig,
  GeneratedFilename,
} from "../../services/filename-generator.service";

@Component({
  selector: "app-output-config-section",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: "./output-config-section.component.html",
  styleUrls: ["./output-config-section.component.scss"],
})
export class OutputConfigSectionComponent {
  outputConfig = input.required<OutputFileConfig>();
  generatedFilename = input<GeneratedFilename | null>(null);
  currentOutputPath = input<string>("");
  configChanged = output<Partial<OutputFileConfig>>();
  filenameChanged = output<string>();
  selectOutputPath = output<void>();

  onConfigChange(newConfig: Partial<OutputFileConfig>): void {
    this.configChanged.emit(newConfig);
  }

  onCrfChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    if (!isNaN(value) && value >= 0 && value <= 51) {
      this.configChanged.emit({ crf: value });
    }
  }

  onFilenameChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.filenameChanged.emit(target.value);
  }

  onSelectOutputPath(): void {
    this.selectOutputPath.emit();
  }
}
