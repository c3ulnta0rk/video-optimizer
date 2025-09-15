import { TestBed } from '@angular/core/testing';
import { SettingsService, AppSettings } from './settings.service';
import { NotificationService } from './notification.service';
import { tauriMocks } from '../testing/tauri-mocks';
import { createMockConversionConfig } from '../testing/test-helpers';

// Mock Tauri modules at the global level to prevent import errors
const mockInvoke = jasmine.createSpy('invoke');

// Mock Tauri Store
class MockStore {
  private data = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: any): Promise<void> {
    this.data.set(key, value);
  }

  async save(): Promise<void> {
    // Mock save operation
  }

  async clear(): Promise<void> {
    this.data.clear();
  }

  // For testing purposes
  setMockData(key: string, value: any): void {
    this.data.set(key, value);
  }

  hasMockData(key: string): boolean {
    return this.data.has(key);
  }
}

// Mock for Tauri store load function
let mockStore: MockStore;
const mockLoadStore = jasmine.createSpy('load').and.callFake(() => {
  mockStore = new MockStore();
  return Promise.resolve(mockStore);
});

// Mock for inject function
const mockInject = jasmine.createSpy('inject');

// Mocks pour les services
const mockNotificationService = {
  showSuccess: jasmine.createSpy('showSuccess'),
  showError: jasmine.createSpy('showError'),
  showWarning: jasmine.createSpy('showWarning'),
  showInfo: jasmine.createSpy('showInfo'),
  showErrorWithDetails: jasmine.createSpy('showErrorWithDetails')
};

describe('SettingsService', () => {
  let service: SettingsService;
  let defaultSettings: AppSettings;

  beforeEach(async () => {
    // Setup global mocks
    tauriMocks.setupGlobalMocks();
    mockInvoke.and.callFake((command: string, args?: any) => {
      return tauriMocks.getMock(command)(args);
    });

    // Mock Tauri Store module
    const globalObject = (globalThis as any) || (window as any);
    globalObject.__TAURI__ = {
      ...globalObject.__TAURI__,
      plugins: {
        ...globalObject.__TAURI__.plugins,
        store: {
          load: mockLoadStore
        }
      }
    };

    // Mock inject function to return our mock service
    mockInject.and.returnValue(mockNotificationService);

    defaultSettings = {
      tmdbApiKey: "",
      theme: "auto",
      videoConfig: {
        format: "mkv",
        quality: "1080p",
        codec: "h265",
        audio: "aac",
        crf: 20,
        group: "VideoOptimizer",
      },
      defaultOutputPath: null,
    };

    TestBed.configureTestingModule({
      providers: [
        SettingsService,
        { provide: NotificationService, useValue: mockNotificationService }
      ]
    });

    // Create service instance via Angular DI
    service = TestBed.inject(SettingsService);

    // Wait for store initialization
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(() => {
    tauriMocks.cleanupGlobalMocks();
    tauriMocks.resetAllMocks();
    mockNotificationService.showSuccess.calls.reset();
    mockNotificationService.showError.calls.reset();
    mockNotificationService.showWarning.calls.reset();
    mockNotificationService.showInfo.calls.reset();
    mockNotificationService.showErrorWithDetails.calls.reset();
    mockLoadStore.calls.reset();
    mockInject.calls.reset();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      const settings = service.getSettings();
      expect(settings).toEqual(defaultSettings);
    });

    it('should handle store initialization failure', async () => {
      mockLoadStore.and.returnValue(Promise.reject('Store init failed'));
      
      const newService = new SettingsService();
      (newService as any).notificationService = mockNotificationService;
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockNotificationService.showErrorWithDetails).toHaveBeenCalledWith(
        "Impossible d'initialiser les paramètres, utilisation des valeurs par défaut",
        'Store init failed'
      );
    });

    it('should load existing settings from store', async () => {
      const storedSettings: AppSettings = {
        ...defaultSettings,
        tmdbApiKey: 'test-key',
        theme: 'dark'
      };

      mockStore.setMockData('app_settings', storedSettings);
      
      const newService = new SettingsService();
      (newService as any).notificationService = mockNotificationService;
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const settings = newService.getSettings();
      expect(settings.tmdbApiKey).toBe('test-key');
      expect(settings.theme).toBe('dark');
    });

    it('should merge stored settings with defaults', async () => {
      const partialSettings = {
        tmdbApiKey: 'partial-key'
      };

      mockStore.setMockData('app_settings', partialSettings);
      
      const newService = new SettingsService();
      (newService as any).notificationService = mockNotificationService;
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const settings = newService.getSettings();
      expect(settings.tmdbApiKey).toBe('partial-key');
      expect(settings.theme).toBe('auto'); // Default value preserved
      expect(settings.videoConfig).toEqual(defaultSettings.videoConfig);
    });
  });

  describe('Settings Management', () => {
    it('should update settings', async () => {
      const updates = {
        tmdbApiKey: 'new-key',
        theme: 'dark' as const
      };

      await service.updateSettings(updates);

      const settings = service.getSettings();
      expect(settings.tmdbApiKey).toBe('new-key');
      expect(settings.theme).toBe('dark');
    });

    it('should handle save failure', async () => {
      const mockSaveSpy = spyOn(mockStore, 'save').and.returnValue(Promise.reject('Save failed'));
      
      await service.updateSettings({ tmdbApiKey: 'test-key' });

      expect(mockNotificationService.showErrorWithDetails).toHaveBeenCalledWith(
        'Impossible de sauvegarder les paramètres',
        'Save failed',
        jasmine.objectContaining({ action: 'Réessayer' })
      );
    });

    it('should handle store not initialized on save', async () => {
      (service as any).store = null;
      
      await service.updateSettings({ tmdbApiKey: 'test-key' });

      expect(mockNotificationService.showWarning).toHaveBeenCalledWith(
        'Impossible de sauvegarder les paramètres : stockage non initialisé'
      );
    });
  });

  describe('TMDB API Key', () => {
    it('should get TMDB API key', () => {
      expect(service.getTmdbApiKey()).toBe('');
    });

    it('should set TMDB API key', async () => {
      await service.setTmdbApiKey('test-api-key');
      
      expect(service.getTmdbApiKey()).toBe('test-api-key');
    });
  });

  describe('Theme Management', () => {
    it('should get theme', () => {
      expect(service.getTheme()).toBe('auto');
    });

    it('should set theme', async () => {
      await service.setTheme('dark');
      
      expect(service.getTheme()).toBe('dark');
    });

    it('should toggle theme from light to dark', async () => {
      await service.setTheme('light');
      service.toggleTheme();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(service.getTheme()).toBe('dark');
    });

    it('should toggle theme from dark to light', async () => {
      await service.setTheme('dark');
      service.toggleTheme();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(service.getTheme()).toBe('light');
    });

    it('should toggle theme from auto to light', async () => {
      await service.setTheme('auto');
      service.toggleTheme();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(service.getTheme()).toBe('light');
    });
  });

  describe('Video Configuration', () => {
    it('should get video config', () => {
      const config = service.getVideoConfig();
      expect(config).toEqual(defaultSettings.videoConfig);
    });

    it('should set video config', async () => {
      const newConfig = createMockConversionConfig({
        format: 'mp4' as 'mp4',
        quality: '720p' as '720p',
        codec: 'h264' as 'h264'
      });

      await service.setVideoConfig(newConfig);
      
      const config = service.getVideoConfig();
      expect(config.format).toBe('mp4');
      expect(config.quality).toBe('720p');
      expect(config.codec).toBe('h264');
    });

    it('should update video config partially', async () => {
      const updates = {
        format: 'mp4' as 'mp4',
        crf: 18
      };

      await service.updateVideoConfig(updates);
      
      const config = service.getVideoConfig();
      expect(config.format).toBe('mp4');
      expect(config.crf).toBe(18);
      expect(config.codec).toBe('h265'); // Unchanged
    });
  });

  describe('Default Output Path', () => {
    it('should get default output path', () => {
      expect(service.getDefaultOutputPath()).toBeNull();
    });

    it('should set default output path', async () => {
      const path = '/test/output';
      
      await service.setDefaultOutputPath(path);
      
      expect(service.getDefaultOutputPath()).toBe(path);
    });

    it('should set default output path to null', async () => {
      await service.setDefaultOutputPath('/test/output');
      expect(service.getDefaultOutputPath()).toBe('/test/output');
      
      await service.setDefaultOutputPath(null);
      
      expect(service.getDefaultOutputPath()).toBeNull();
    });
  });

  describe('Settings Observable', () => {
    it('should emit settings changes', (done) => {
      let emissionCount = 0;
      
      service.settings$.subscribe(settings => {
        emissionCount++;
        
        if (emissionCount === 1) {
          // Initial emission
          expect(settings).toEqual(defaultSettings);
        } else if (emissionCount === 2) {
          // After update
          expect(settings.tmdbApiKey).toBe('observable-test-key');
          done();
        }
      });

      // Trigger update
      service.setTmdbApiKey('observable-test-key');
    });
  });

  describe('Error Handling', () => {
    it('should handle load settings error', async () => {
      const mockGetSpy = spyOn(mockStore, 'get').and.returnValue(Promise.reject('Load failed'));
      
      const newService = new SettingsService();
      (newService as any).notificationService = mockNotificationService;
      
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockNotificationService.showErrorWithDetails).toHaveBeenCalledWith(
        'Impossible de charger les paramètres, utilisation des valeurs par défaut',
        'Load failed'
      );
    });

    it('should handle store not initialized on load', async () => {
      (service as any).store = null;
      
      await (service as any).loadSettings();

      expect(mockNotificationService.showWarning).toHaveBeenCalledWith(
        'Stockage des paramètres non initialisé, utilisation des valeurs par défaut'
      );
    });
  });

  describe('Default Settings', () => {
    it('should provide correct default settings', () => {
      const defaults = (service as any).getDefaultSettings();
      
      expect(defaults).toEqual({
        tmdbApiKey: "",
        theme: "auto",
        videoConfig: {
          format: "mkv",
          quality: "1080p",
          codec: "h265",
          audio: "aac",
          crf: 20,
          group: "VideoOptimizer",
        },
        defaultOutputPath: null,
      });
    });
  });
});