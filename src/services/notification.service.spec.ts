import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationService, NotificationType } from './notification.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// Mock pour sendNotification de Tauri
const mockSendNotification = jasmine.createSpy('sendNotification').and.returnValue(Promise.resolve());

// Mock pour MatSnackBar
const mockSnackBar = {
  open: jasmine.createSpy('open').and.returnValue({
    onAction: jasmine.createSpy('onAction').and.returnValue({
      subscribe: jasmine.createSpy('subscribe')
    })
  })
};

describe('NotificationService', () => {
  let service: NotificationService;
  
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [
        NotificationService,
        { provide: MatSnackBar, useValue: mockSnackBar }
      ]
    });
    
    service = TestBed.inject(NotificationService);
    
    // Reset spies
    mockSnackBar.open.calls.reset();
    mockSendNotification.calls.reset();
    
    // Mock Tauri sendNotification globally
    (window as any).__TAURI__ = {
      plugins: {
        notification: {
          sendNotification: mockSendNotification
        }
      }
    };
  });

  afterEach(() => {
    // Cleanup global mocks
    delete (window as any).__TAURI__;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('showSuccess', () => {
    it('should show success notification with correct styling', () => {
      const message = 'Operation completed successfully';
      
      service.showSuccess(message);
      
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        message,
        'Fermer',
        jasmine.objectContaining({
          duration: 4000,
          panelClass: ['success-snackbar'],
          horizontalPosition: 'end',
          verticalPosition: 'top'
        })
      );
    });

    it('should use custom duration when provided', () => {
      const message = 'Success message';
      const customDuration = 2000;
      
      service.showSuccess(message, { duration: customDuration });
      
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        message,
        'Fermer',
        jasmine.objectContaining({
          duration: customDuration
        })
      );
    });

    it('should use custom action text when provided', () => {
      const message = 'Success message';
      const customAction = 'OK';
      
      service.showSuccess(message, { action: customAction });
      
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        message,
        customAction,
        jasmine.anything()
      );
    });
  });

  describe('showError', () => {
    it('should show error notification with correct styling', () => {
      const message = 'An error occurred';
      
      service.showError(message);
      
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        message,
        'Fermer',
        jasmine.objectContaining({
          duration: 10000,
          panelClass: ['error-snackbar'],
          horizontalPosition: 'end',
          verticalPosition: 'top'
        })
      );
    });

    it('should log error message to console', () => {
      spyOn(console, 'error');
      const message = 'Error message';
      
      service.showError(message);
      
      expect(console.error).toHaveBeenCalledWith(
        jasmine.stringMatching(/\[NotificationService\].*Error message/)
      );
    });
  });

  describe('showWarning', () => {
    it('should show warning notification with correct styling', () => {
      const message = 'Warning message';
      
      service.showWarning(message);
      
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        message,
        'Fermer',
        jasmine.objectContaining({
          duration: 8000,
          panelClass: ['warning-snackbar']
        })
      );
    });
  });

  describe('showInfo', () => {
    it('should show info notification with correct styling', () => {
      const message = 'Info message';
      
      service.showInfo(message);
      
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        message,
        'Fermer',
        jasmine.objectContaining({
          duration: 6000,
          panelClass: ['info-snackbar']
        })
      );
    });
  });

  describe('showErrorWithDetails', () => {
    it('should show user-friendly error and log technical details', () => {
      spyOn(console, 'error');
      const userMessage = 'Something went wrong';
      const technicalError = new Error('Database connection failed');
      
      service.showErrorWithDetails(userMessage, technicalError);
      
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        userMessage,
        'Fermer',
        jasmine.anything()
      );
      
      expect(console.error).toHaveBeenCalledWith(
        `[Error Details] ${userMessage}:`,
        technicalError
      );
    });

    it('should handle string errors', () => {
      const userMessage = 'Operation failed';
      const stringError = 'Network timeout';
      
      service.showErrorWithDetails(userMessage, stringError);
      
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        userMessage,
        'Fermer',
        jasmine.anything()
      );
    });

    it('should handle unknown error types', () => {
      const userMessage = 'Unknown error';
      const unknownError = { someProperty: 'value' };
      
      service.showErrorWithDetails(userMessage, unknownError);
      
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        userMessage,
        'Fermer',
        jasmine.anything()
      );
    });
  });

  describe('system notifications', () => {
    it('should send system notification when requested', async () => {
      const message = 'Test notification';
      
      service.showSuccess(message, { showSystemNotification: true });
      
      // Give time for async operation
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockSendNotification).toHaveBeenCalledWith({
        title: 'Succès',
        body: message,
        icon: 'icons/32x32.png'
      });
    });

    it('should handle system notification errors gracefully', async () => {
      spyOn(console, 'warn');
      mockSendNotification.and.returnValue(Promise.reject('Not available'));
      
      service.showError('Test error', { showSystemNotification: true });
      
      // Give time for async operation
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(console.warn).toHaveBeenCalledWith(
        'Impossible d\'envoyer la notification système:',
        'Not available'
      );
    });
  });

  describe('notification types', () => {
    it('should use correct titles for different notification types', async () => {
      const testCases = [
        { method: 'showSuccess', expectedTitle: 'Succès' },
        { method: 'showError', expectedTitle: 'Erreur' },
        { method: 'showWarning', expectedTitle: 'Attention' },
        { method: 'showInfo', expectedTitle: 'Information' }
      ];

      for (const testCase of testCases) {
        mockSendNotification.calls.reset();
        
        (service as any)[testCase.method]('Test message', { showSystemNotification: true });
        
        // Give time for async operation
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(mockSendNotification).toHaveBeenCalledWith(
          jasmine.objectContaining({
            title: testCase.expectedTitle
          })
        );
      }
    });
  });
});