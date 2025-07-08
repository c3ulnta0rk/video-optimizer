import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { provideAnimations } from "@angular/platform-browser/animations";
import { provideHttpClient } from "@angular/common/http";
import { TrayIconService } from "./services/tray-icon.service";
import { inject, provideAppInitializer } from "@angular/core";

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations(),
    provideHttpClient(),
    provideAppInitializer(() => {
      inject(TrayIconService);
    }),
  ],
});
