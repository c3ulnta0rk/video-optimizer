import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { FilesManagerService, VideoFile } from './files-manager.service';
import { NotificationService } from './notification.service';
import { MovieTitleParserService } from './movie-title-parser.service';
import { FfmpegFormatsService } from './ffmpeg-formats.service';
import { tauriMocks, mockVideoMetadata } from '../testing/tauri-mocks';

// Mock services
const mockNotificationService = {
  showSuccess: jasmine.createSpy('showSuccess'),
  showError: jasmine.createSpy('showError'),
  showWarning: jasmine.createSpy('showWarning'),
  showInfo: jasmine.createSpy('showInfo'),
  showErrorWithDetails: jasmine.createSpy('showErrorWithDetails')
};

const mockMovieParserService = {
  parseMovieTitle: jasmine.createSpy('parseMovieTitle'),
  searchMovieWithAlternatives: jasmine.createSpy('searchMovieWithAlternatives')
};

const mockFfmpegService = {
  getCommonFormats: jasmine.createSpy('getCommonFormats').and.returnValue([]),
  getCommonVideoFormats: jasmine.createSpy('getCommonVideoFormats').and.returnValue([
    { name: 'MP4', extension: 'mp4', codecs: ['h264', 'aac'] },
    { name: 'MKV', extension: 'mkv', codecs: ['h264', 'aac'] }
  ]),
  isFormatSupported: jasmine.createSpy('isFormatSupported').and.returnValue(true)
};

const mockDialog = {
  open: jasmine.createSpy('open').and.returnValue({
    afterClosed: jasmine.createSpy('afterClosed').and.returnValue({ subscribe: jasmine.createSpy('subscribe') })
  })
};

describe('FilesManagerService', () => {
  let service: FilesManagerService;

  beforeEach(() => {
    // Setup global mocks
    tauriMocks.setupGlobalMocks();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        FilesManagerService,
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: MovieTitleParserService, useValue: mockMovieParserService },
        { provide: FfmpegFormatsService, useValue: mockFfmpegService },
        { provide: MatDialog, useValue: mockDialog }
      ]
    });

    service = TestBed.inject(FilesManagerService);
  });

  afterEach(() => {
    tauriMocks.cleanupGlobalMocks();
    tauriMocks.resetAllMocks();
    Object.values(mockNotificationService).forEach(spy => (spy as jasmine.Spy).calls.reset());
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Video Paths Management', () => {
    it('should start with empty video paths', () => {
      expect(service.videosPaths()).toEqual([]);
    });

    it('should add video paths', async () => {
      const paths = ['/test/video1.mp4', '/test/video2.mkv'];
      
      await service.addVideosPaths(paths);
      
      expect(service.videosPaths()).toEqual(paths);
    });

    it('should remove video path', () => {
      const paths = ['/test/video1.mp4', '/test/video2.mkv'];
      service.videosPaths.set(paths);
      
      service.removeVideoPath('/test/video1.mp4');
      
      expect(service.videosPaths()).toEqual(['/test/video2.mkv']);
    });
  });

  describe('Video Files Management', () => {
    it('should start with empty video files', () => {
      expect(service.videoFiles()).toEqual([]);
    });

    it('should select video', () => {
      const mockVideo: VideoFile = { 
        path: '/test/video.mp4', 
        name: 'video.mp4', 
        loading: false 
      };
      
      service.selectVideo(mockVideo);
      
      expect(service.selectedVideo()).toEqual(mockVideo);
    });

    it('should clear selected video', () => {
      const mockVideo: VideoFile = { 
        path: '/test/video.mp4', 
        name: 'video.mp4', 
        loading: false 
      };
      service.selectVideo(mockVideo);
      
      service.selectVideo(null);
      
      expect(service.selectedVideo()).toBeNull();
    });
  });

  describe('Directory Mode', () => {
    it('should toggle directory mode', () => {
      expect(service.directory()).toBeFalse();
      
      service.toggleDirectoryMode(true);
      
      expect(service.directory()).toBeTrue();
      
      service.toggleDirectoryMode(false);
      
      expect(service.directory()).toBeFalse();
    });

    it('should toggle directory mode without parameter', () => {
      expect(service.directory()).toBeFalse();
      
      service.toggleDirectoryMode();
      
      expect(service.directory()).toBeTrue();
      
      service.toggleDirectoryMode();
      
      expect(service.directory()).toBeFalse();
    });
  });

  describe('Utility Methods', () => {
    it('should format file size correctly', () => {
      expect(service.formatFileSize(1024)).toBe('1 KB');
      expect(service.formatFileSize(1048576)).toBe('1 MB');
      expect(service.formatFileSize(1073741824)).toBe('1 GB');
      expect(service.formatFileSize(500)).toBe('500 B');
    });

    it('should format duration correctly', () => {
      expect(service.formatDuration(3661)).toBe('1:01:01'); // 1 hour, 1 minute, 1 second
      expect(service.formatDuration(61)).toBe('1:01'); // 1 minute, 1 second
      expect(service.formatDuration(30)).toBe('0:30'); // 30 seconds
    });
  });

  describe('FFmpeg Integration', () => {
    it('should check FFprobe availability', async () => {
      // Setup the mock to return true
      tauriMocks.getMock('check_ffprobe_available').and.returnValue(Promise.resolve(true));
      
      const result = await service.checkFfprobeAvailable();
      
      expect(result).toBe(true);
    });

    it('should handle FFprobe not available', async () => {
      tauriMocks.getMock('check_ffprobe_available').and.returnValue(Promise.resolve(false));
      
      const result = await service.checkFfprobeAvailable();
      
      expect(result).toBe(false);
    });

    it('should check output format support', () => {
      // This method should exist based on the grep results
      const result = service.isOutputFormatSupported('mp4');
      expect(typeof result).toBe('boolean');
    });

    it('should get common output formats', () => {
      const formats = service.getCommonOutputFormats();
      expect(Array.isArray(formats)).toBeTrue();
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', () => {
      // Method should exist based on grep results
      expect(() => service.clearCache()).not.toThrow();
    });

    it('should get cache size', () => {
      const cacheSize = service.getCacheSize();
      expect(typeof cacheSize).toBe('object');
    });
  });

  describe('Movie Info Management', () => {
    it('should update movie info', () => {
      const filePath = '/test/video.mp4';
      const movieInfo = {
        title: 'Test Movie',
        year: 2023,
        type: 'movie' as const,
        confidence: 0.9
      };
      
      expect(() => service.updateMovieInfo(filePath, movieInfo)).not.toThrow();
    });

    it('should load movie info for single file', async () => {
      const filePath = '/test/video.mp4';
      
      // This should not throw
      await expectAsync(service.loadMovieInfo(filePath)).not.toBeRejected();
    });

    it('should load all movie info', async () => {
      await expectAsync(service.loadAllMovieInfo()).not.toBeRejected();
    });

    it('should load all movie info sequentially', async () => {
      await expectAsync(service.loadAllMovieInfoSequentially()).not.toBeRejected();
    });
  });

  describe('Metadata Loading', () => {
    it('should load video metadata', async () => {
      tauriMocks.getMock('get_video_metadata').and.returnValue(Promise.resolve(mockVideoMetadata));
      
      await expectAsync(service.loadVideoMetadata()).not.toBeRejected();
    });

    it('should load video metadata sequentially', async () => {
      tauriMocks.getMock('get_video_metadata').and.returnValue(Promise.resolve(mockVideoMetadata));
      
      await expectAsync(service.loadVideoMetadataSequentially()).not.toBeRejected();
    });
  });

  describe('Dialog Integration', () => {
    it('should open FFmpeg formats dialog', async () => {
      mockDialog.open().afterClosed().subscribe = jasmine.createSpy('subscribe').and.callFake((callback: any) => {
        callback({ name: 'mp4', description: 'MP4 Format', extensions: ['mp4'] });
        return { unsubscribe: jasmine.createSpy('unsubscribe') };
      });
      
      const result = await service.openFfmpegFormatsDialog();
      
      expect(mockDialog.open).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should open manual search dialog', () => {
      const filePath = '/test/movie.mp4';
      service.videoFiles.set([{ path: filePath, name: 'movie.mp4', loading: false }]);
      
      const result = service.openManualSearchDialog(filePath);
      
      expect(result).toBeDefined();
      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should open movie alternatives dialog', () => {
      const filePath = '/test/movie.mp4';
      service.videoFiles.set([{ path: filePath, name: 'movie.mp4', loading: false }]);
      
      const result = service.openMovieAlternativesDialog(filePath);
      
      // Should return null if no movie info is cached
      expect(result).toBeNull();
    });
  });

  describe('File Selection', () => {
    it('should select files via dialog', async () => {
      // Mock Tauri dialog
      const globalObject = (globalThis as any) || (window as any);
      globalObject.__TAURI__ = {
        plugins: {
          dialog: {
            open: jasmine.createSpy('open').and.returnValue(Promise.resolve(['/test/video.mp4']))
          }
        }
      };
      
      await service.selectFiles();
      
      expect(globalObject.__TAURI__.plugins.dialog.open).toHaveBeenCalled();
      expect(service.videosPaths()).toContain('/test/video.mp4');
    });

    it('should handle cancelled file selection', async () => {
      const globalObject = (globalThis as any) || (window as any);
      globalObject.__TAURI__ = {
        plugins: {
          dialog: {
            open: jasmine.createSpy('open').and.returnValue(Promise.resolve(null))
          }
        }
      };
      
      await service.selectFiles();
      
      // Should not crash when user cancels
      expect(globalObject.__TAURI__.plugins.dialog.open).toHaveBeenCalled();
    });
  });
});