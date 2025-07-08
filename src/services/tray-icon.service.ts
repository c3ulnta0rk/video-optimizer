import { Injectable } from "@angular/core";
import { TrayIcon, TrayIconOptions } from "@tauri-apps/api/tray";
import { defaultWindowIcon } from "@tauri-apps/api/app";

@Injectable({
  providedIn: "root",
})
export class TrayIconService {
  constructor() {
    this.init();
  }

  async init() {
    const options: TrayIconOptions = {
      icon: (await defaultWindowIcon()) || "",
      tooltip: "Video Optimizer",
    };
    const tray = await TrayIcon.new(options);
    console.log(tray);
  }
}
