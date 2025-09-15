import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { sendNotification } from '@tauri-apps/plugin-notification';

export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export interface NotificationOptions {
  duration?: number;
  action?: string;
  showSystemNotification?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  constructor(private readonly snackBar: MatSnackBar) {}

  private readonly defaultDurations = {
    [NotificationType.SUCCESS]: 4000,
    [NotificationType.INFO]: 6000,
    [NotificationType.WARNING]: 8000,
    [NotificationType.ERROR]: 10000
  };

  private readonly cssClasses = {
    [NotificationType.SUCCESS]: ['success-snackbar'],
    [NotificationType.ERROR]: ['error-snackbar'],
    [NotificationType.WARNING]: ['warning-snackbar'],
    [NotificationType.INFO]: ['info-snackbar']
  };

  showSuccess(message: string, options: NotificationOptions = {}): void {
    this.showNotification(message, NotificationType.SUCCESS, options);
  }

  showError(message: string, options: NotificationOptions = {}): void {
    this.showNotification(message, NotificationType.ERROR, options);
    this.logError(message);
  }

  showWarning(message: string, options: NotificationOptions = {}): void {
    this.showNotification(message, NotificationType.WARNING, options);
  }

  showInfo(message: string, options: NotificationOptions = {}): void {
    this.showNotification(message, NotificationType.INFO, options);
  }

  private showNotification(
    message: string, 
    type: NotificationType, 
    options: NotificationOptions
  ): void {
    const duration = options.duration || this.defaultDurations[type];
    const action = options.action || 'Fermer';

    // Affichage du snackbar
    const snackBarRef = this.snackBar.open(message, action, {
      duration,
      panelClass: this.cssClasses[type],
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });

    // Notification système si demandée
    if (options.showSystemNotification) {
      this.sendSystemNotification(message, type);
    }

    // Action personnalisée si fournie
    if (options.action) {
      snackBarRef.onAction().subscribe(() => {
        // L'action sera gérée par le composant appelant
      });
    }
  }

  private async sendSystemNotification(message: string, type: NotificationType): Promise<void> {
    try {
      await sendNotification({
        title: this.getNotificationTitle(type),
        body: message,
        icon: this.getNotificationIcon(type)
      });
    } catch (error) {
      console.warn('Impossible d\'envoyer la notification système:', error);
    }
  }

  private getNotificationTitle(type: NotificationType): string {
    switch (type) {
      case NotificationType.SUCCESS:
        return 'Succès';
      case NotificationType.ERROR:
        return 'Erreur';
      case NotificationType.WARNING:
        return 'Attention';
      case NotificationType.INFO:
        return 'Information';
      default:
        return 'Video Optimizer';
    }
  }

  private getNotificationIcon(type: NotificationType): string {
    // Icons peuvent être personnalisées selon le type
    return 'icons/32x32.png';
  }

  private logError(message: string): void {
    console.error(`[NotificationService] ${new Date().toISOString()}: ${message}`);
  }

  // Méthode pour les erreurs avec stack trace
  showErrorWithDetails(userMessage: string, error: unknown, options: NotificationOptions = {}): void {
    const errorMessage = this.formatErrorMessage(error);
    this.showError(userMessage, options);
    console.error(`[Error Details] ${userMessage}:`, error);
  }

  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Erreur inconnue';
  }
}