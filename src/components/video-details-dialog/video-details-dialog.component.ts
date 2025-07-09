import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { VideoFile } from "../../services/files-manager.service";
import { VideoDetailsComponent } from "../video-details/video-details.component";

@Component({
  selector: "app-video-details-dialog",
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    VideoDetailsComponent,
  ],
  templateUrl: "./video-details-dialog.component.html",
  styleUrls: ["./video-details-dialog.component.scss"],
})
export class VideoDetailsDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<VideoDetailsDialogComponent>
  );
  private readonly dialogData = inject(MAT_DIALOG_DATA);

  get video(): VideoFile {
    return this.dialogData.video;
  }

  onCloseDetails(): void {
    this.dialogRef.close();
  }
}
