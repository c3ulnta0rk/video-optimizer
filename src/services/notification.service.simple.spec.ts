import { NotificationService } from './notification.service';

// Test simple sans Angular TestBed pour vérifier si le problème vient de Zone.js
describe('NotificationService (Simple)', () => {
  let service: NotificationService;
  let mockSnackBar: any;

  beforeEach(() => {
    // Mock MatSnackBar
    mockSnackBar = {
      open: jasmine.createSpy('open').and.returnValue({
        onAction: jasmine.createSpy('onAction').and.returnValue({
          subscribe: jasmine.createSpy('subscribe')
        })
      })
    };

    // Create service instance manually with mock
    service = new NotificationService(mockSnackBar);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show success notification', () => {
    const message = 'Success message';
    
    service.showSuccess(message);
    
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      message,
      'Fermer',
      jasmine.objectContaining({
        duration: 4000,
        panelClass: ['success-snackbar']
      })
    );
  });

  it('should show error notification', () => {
    const message = 'Error message';
    
    service.showError(message);
    
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      message,
      'Fermer',
      jasmine.objectContaining({
        duration: 10000,
        panelClass: ['error-snackbar']
      })
    );
  });
});