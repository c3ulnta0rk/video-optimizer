import { TestBed } from '@angular/core/testing';
import { ConversionService, ConversionResult, ConversionState } from './conversion.service';
import { SettingsService } from './settings.service';
import { NotificationService } from './notification.service';
import { tauriMocks } from '../testing/tauri-mocks';
import { createMockVideoFile, createMockConversionConfig, createMockQueueItem } from '../testing/test-helpers';

// Mock Tauri modules at the global level to prevent import errors
const mockInvoke = jasmine.createSpy('invoke');
const mockListen = jasmine.createSpy('listen').and.returnValue(Promise.resolve());

// Mock for invoke will be setup globally

// Mocks pour les services
const mockSettingsService = {
  getSettings: jasmine.createSpy('getSettings').and.returnValue({
    videoConfig: createMockConversionConfig()
  }),
  getDefaultOutputPath: jasmine.createSpy('getDefaultOutputPath').and.returnValue('/test/output')
};

const mockNotificationService = {
  showSuccess: jasmine.createSpy('showSuccess'),
  showError: jasmine.createSpy('showError'),
  showWarning: jasmine.createSpy('showWarning'),
  showInfo: jasmine.createSpy('showInfo'),
  showErrorWithDetails: jasmine.createSpy('showErrorWithDetails')
};

// mockListen is already declared above

describe('ConversionService', () => {
  let service: ConversionService;

  beforeEach(() => {
    // Setup global mocks
    tauriMocks.setupGlobalMocks();
    mockInvoke.and.callFake((command: string, args?: any) => {
      return tauriMocks.getMock(command)(args);
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: NotificationService, useValue: mockNotificationService }
      ]
    });

    // Create service instance manually  
    service = new ConversionService(mockSettingsService as any, mockNotificationService as any);
  });

  afterEach(() => {
    tauriMocks.cleanupGlobalMocks();
    tauriMocks.resetAllMocks();
    mockNotificationService.showSuccess.calls.reset();
    mockNotificationService.showError.calls.reset();
    mockNotificationService.showWarning.calls.reset();
    mockNotificationService.showInfo.calls.reset();
    mockNotificationService.showErrorWithDetails.calls.reset();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Queue Management', () => {
    it('should add video to queue', () => {
      const video = createMockVideoFile();
      const config = createMockConversionConfig();
      
      service.addToQueue(video, config, [0], []);
      
      const state = service.conversionState();
      expect(state.queue).toHaveSize(1);
      expect(state.queue[0].video.path).toBe(video.path);
      expect(state.queue[0].status).toBe('pending');
    });

    it('should prevent duplicate videos in queue', () => {
      const video = createMockVideoFile();
      const config = createMockConversionConfig();
      
      service.addToQueue(video, config, [0], []);
      service.addToQueue(video, config, [0], []); // Duplicate
      
      const state = service.conversionState();
      expect(state.queue).toHaveSize(1);
    });

    it('should remove video from queue', () => {
      const video = createMockVideoFile();
      const config = createMockConversionConfig();
      
      service.addToQueue(video, config, [0], []);
      service.removeFromQueue(video.path);
      
      const state = service.conversionState();
      expect(state.queue).toHaveSize(0);
    });

    it('should clear entire queue', () => {
      const video1 = createMockVideoFile({ path: '/test/video1.mp4' });
      const video2 = createMockVideoFile({ path: '/test/video2.mp4' });
      const config = createMockConversionConfig();
      
      service.addToQueue(video1, config, [0], []);
      service.addToQueue(video2, config, [0], []);
      service.clearQueue();
      
      const state = service.conversionState();
      expect(state.queue).toHaveSize(0);
    });

    it('should get queue item by video path', () => {
      const video = createMockVideoFile();
      const config = createMockConversionConfig();
      
      service.addToQueue(video, config, [0], []);
      const queueItem = service.getQueueItem(video.path);
      
      expect(queueItem).toBeDefined();
      expect(queueItem!.video.path).toBe(video.path);
    });

    it('should return undefined for non-existent queue item', () => {
      const queueItem = service.getQueueItem('/non/existent/path.mp4');
      expect(queueItem).toBeUndefined();
    });
  });

  describe('Conversion States', () => {
    it('should track conversion state correctly', () => {
      expect(service.isConverting()).toBeFalse();
      expect(service.isQueueProcessing()).toBeFalse();
      expect(service.getCurrentConvertingVideo()).toBeNull();
    });

    it('should update progress for queue item', () => {
      const video = createMockVideoFile();
      const config = createMockConversionConfig();
      const mockProgress = {
        progress: 0.5,
        current_time: 1800,
        total_time: 3600,
        speed: 2.5,
        eta: 720,
        status: 'Converting'
      };
      
      service.addToQueue(video, config, [0], []);
      service.updateQueueItemProgress(video.path, mockProgress);
      
      const queueItem = service.getQueueItem(video.path);
      expect(queueItem!.progress).toEqual(mockProgress);
    });

    it('should handle progress update for non-existent video', () => {
      const mockProgress = {
        progress: 0.5,
        current_time: 1800,
        total_time: 3600,
        speed: 2.5,
        eta: 720,
        status: 'Converting'
      };
      
      // Cette méthode met à jour silencieusement, pas d'erreur affichée
      service.updateQueueItemProgress('/non/existent.mp4', mockProgress);
      
      // Vérifier que l'état n'a pas été modifié de manière incorrecte
      const state = service.conversionState();
      expect(state.queue).toHaveSize(0);
    });
  });

  describe('Single Conversion', () => {
    it('should start conversion successfully', async () => {
      const video = createMockVideoFile();
      const config = createMockConversionConfig();
      const expectedResult: ConversionResult = {
        success: true,
        output_path: '/test/output.mkv',
        duration: 120
      };
      
      tauriMocks.getMock('start_video_conversion').and.returnValue(Promise.resolve(expectedResult));
      
      const result = await service.startConversion(video, config, [0], []);
      
      expect(result).toEqual(expectedResult);
      expect(mockNotificationService.showSuccess).toHaveBeenCalledWith(
        jasmine.stringContaining('Conversion terminée avec succès')
      );
    });

    it('should handle conversion failure', async () => {
      const video = createMockVideoFile();
      const config = createMockConversionConfig();
      const expectedResult: ConversionResult = {
        success: false,
        error: 'FFmpeg not found',
        duration: 0
      };
      
      tauriMocks.getMock('start_video_conversion').and.returnValue(Promise.resolve(expectedResult));
      
      const result = await service.startConversion(video, config, [0], []);
      
      expect(result).toEqual(expectedResult);
      expect(mockNotificationService.showError).toHaveBeenCalledWith(
        jasmine.stringContaining('Échec de la conversion'),
        jasmine.objectContaining({ showSystemNotification: true })
      );
    });
  });

  describe('Sequential Processing', () => {
    it('should process queue sequentially', async () => {
      const video1 = createMockVideoFile({ path: '/test/video1.mp4' });
      const video2 = createMockVideoFile({ path: '/test/video2.mp4' });
      const config = createMockConversionConfig();
      
      service.addToQueue(video1, config, [0], []);
      service.addToQueue(video2, config, [0], []);
      
      tauriMocks.getMock('start_video_conversion').and.returnValue(
        Promise.resolve({ success: true, output_path: '/test/output.mkv', duration: 120 })
      );
      
      await service.startSequentialConversions([video1.path, video2.path]);
      
      expect(mockNotificationService.showInfo).toHaveBeenCalledWith(
        'Démarrage de la conversion de 2 vidéos'
      );
    });

    it('should not start processing if already processing', async () => {
      const video = createMockVideoFile();
      const config = createMockConversionConfig();
      
      service.addToQueue(video, config, [0], []);
      
      // Simulate already processing
      (service as any)._conversionState.update((state: ConversionState) => ({
        ...state,
        isQueueProcessing: true
      }));
      
      await service.startSequentialConversions([video.path]);
      
      expect(mockNotificationService.showWarning).toHaveBeenCalledWith(
        'Une conversion est déjà en cours, veuillez attendre qu\'elle se termine'
      );
    });

    it('should handle empty queue', async () => {
      await service.startSequentialConversions([]);
      
      expect(mockNotificationService.showWarning).toHaveBeenCalledWith(
        'Aucune vidéo en attente de conversion'
      );
    });
  });

  describe('Stop Operations', () => {
    it('should stop conversion successfully', async () => {
      tauriMocks.getMock('stop_video_conversion').and.returnValue(Promise.resolve(true));
      
      const result = await service.stopConversion();
      
      expect(result).toBeTruthy();
      expect(mockInvoke).toHaveBeenCalledWith('stop_video_conversion');
    });

    it('should handle stop conversion error', async () => {
      tauriMocks.getMock('stop_video_conversion').and.returnValue(Promise.reject('Stop failed'));
      
      const result = await service.stopConversion();
      
      expect(result).toBeFalsy();
      expect(mockNotificationService.showErrorWithDetails).toHaveBeenCalledWith(
        'Impossible d\'arrêter la conversion en cours',
        'Stop failed',
        jasmine.objectContaining({ action: 'Réessayer' })
      );
    });

    it('should stop all conversions', async () => {
      tauriMocks.getMock('stop_video_conversion').and.returnValue(Promise.resolve(true));
      
      const result = await service.stopAllConversions();
      
      expect(result).toBeTruthy();
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup FFmpeg processes successfully', async () => {
      await service.cleanupFfmpegProcesses();
      
      expect(mockInvoke).toHaveBeenCalledWith('cleanup_ffmpeg_processes');
      expect(mockNotificationService.showInfo).toHaveBeenCalledWith(
        'Processus FFmpeg nettoyés'
      );
    });

    it('should handle cleanup error', async () => {
      tauriMocks.getMock('cleanup_ffmpeg_processes').and.returnValue(Promise.reject('Cleanup failed'));
      
      await service.cleanupFfmpegProcesses();
      
      expect(mockNotificationService.showErrorWithDetails).toHaveBeenCalledWith(
        'Impossible de nettoyer les processus FFmpeg',
        'Cleanup failed'
      );
    });

    it('should reset cancelled video', () => {
      const video = createMockVideoFile();
      const config = createMockConversionConfig();
      const queueItem = createMockQueueItem({ 
        video, 
        config, 
        status: 'cancelled' as const,
        error: 'User cancelled'
      });
      
      service.addToQueue(video, config, [0], []);
      // Manually set as cancelled
      (service as any)._conversionState.update((state: ConversionState) => ({
        ...state,
        queue: [queueItem]
      }));
      
      service.resetCancelledVideo(video.path);
      
      const resetItem = service.getQueueItem(video.path);
      expect(resetItem!.status).toBe('pending');
      expect(resetItem!.progress).toBeNull();
      expect(resetItem!.result).toBeNull();
      expect(resetItem!.error).toBeUndefined();
    });
  });

  describe('Error Message Formatting', () => {
    it('should format unknown error', () => {
      const message = (service as any).getReadableErrorMessage(undefined);
      expect(message).toBe('Erreur inconnue');
    });

    it('should format permission denied error', () => {
      const message = (service as any).getReadableErrorMessage('Permission denied for file');
      expect(message).toBe('Accès refusé - Vérifiez les permissions du fichier');
    });

    it('should format file not found error', () => {
      const message = (service as any).getReadableErrorMessage('No such file or directory');
      expect(message).toBe('Fichier introuvable - Le fichier a peut-être été déplacé ou supprimé');
    });

    it('should format disk space error', () => {
      const message = (service as any).getReadableErrorMessage('No space left on device');
      expect(message).toBe('Espace disque insuffisant pour terminer la conversion');
    });

    it('should format FFmpeg not found error', () => {
      const message = (service as any).getReadableErrorMessage('ffmpeg: command not found');
      expect(message).toBe('FFmpeg n\'est pas installé ou accessible');
    });

    it('should format codec error', () => {
      const message = (service as any).getReadableErrorMessage('Invalid codec specified');
      expect(message).toBe('Codec non supporté - Essayez un autre format de sortie');
    });

    it('should format timeout error', () => {
      const message = (service as any).getReadableErrorMessage('Operation timeout');
      expect(message).toBe('La conversion a pris trop de temps et a été interrompue');
    });

    it('should format cancellation error', () => {
      const message = (service as any).getReadableErrorMessage('Conversion was cancelled');
      expect(message).toBe('Conversion annulée par l\'utilisateur');
    });

    it('should truncate long error messages', () => {
      const longError = 'A'.repeat(150);
      const message = (service as any).getReadableErrorMessage(longError);
      expect(message).toBe(longError.substring(0, 100) + '...');
    });
  });

  describe('File Name Extraction', () => {
    it('should extract filename from Unix path', () => {
      const filename = (service as any).getFileName('/path/to/video.mp4');
      expect(filename).toBe('video.mp4');
    });

    it('should extract filename from Windows path', () => {
      const filename = (service as any).getFileName('C:\\path\\to\\video.mp4');
      expect(filename).toBe('video.mp4');
    });

    it('should return full path if no separator found', () => {
      const filename = (service as any).getFileName('video.mp4');
      expect(filename).toBe('video.mp4');
    });
  });
});