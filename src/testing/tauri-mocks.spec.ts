import { tauriMocks, mockVideoMetadata, mockConversionResult } from './tauri-mocks';

describe('TauriMockService', () => {
  beforeEach(() => {
    tauriMocks.setupGlobalMocks();
  });

  afterEach(() => {
    tauriMocks.cleanupGlobalMocks();
    tauriMocks.resetAllMocks();
  });

  it('should be created', () => {
    expect(tauriMocks).toBeTruthy();
  });

  describe('Video Commands', () => {
    it('should mock get_video_metadata successfully', async () => {
      const result = await tauriMocks.getMock('get_video_metadata')({ path: '/test/video.mp4' });
      
      expect(result).toEqual(mockVideoMetadata);
      expect(result.path).toBe('/test/video.mp4');
      expect(result.name).toBe('video.mp4');
      expect(result.size).toBe(104857600);
      expect(result.duration).toBe(3600);
    });

    it('should mock start_video_conversion successfully', async () => {
      const conversionConfig = {
        input_path: '/test/input.mp4',
        output_path: '/test/output.mkv',
        format: 'mkv',
        quality: '1080p',
        codec: 'h265'
      };
      
      const result = await tauriMocks.getMock('start_video_conversion')({ config: conversionConfig });
      
      expect(result).toEqual(mockConversionResult);
      expect(result.success).toBe(true);
      expect(result.output_path).toBe('/test/output.mkv');
      expect(result.duration).toBe(120);
    });

    it('should mock stop_video_conversion successfully', async () => {
      const result = await tauriMocks.getMock('stop_video_conversion')();
      
      expect(result).toBe(true);
    });

    it('should mock cleanup_ffmpeg_processes', async () => {
      await expectAsync(
        tauriMocks.getMock('cleanup_ffmpeg_processes')()
      ).toBeResolved();
    });

    it('should handle conversion error scenarios', () => {
      tauriMocks.createErrorScenarios();
      
      const videoMetadataMock = tauriMocks.getMock('get_video_metadata');
      const conversionMock = tauriMocks.getMock('start_video_conversion');
      
      expect(videoMetadataMock).toBeDefined();
      expect(conversionMock).toBeDefined();
    });
  });

  describe('FFmpeg Commands', () => {
    it('should mock check_ffmpeg_available', async () => {
      const result = await tauriMocks.getMock('check_ffmpeg_available')();
      
      expect(result).toBe(true);
    });

    it('should mock check_ffprobe_available', async () => {
      const result = await tauriMocks.getMock('check_ffprobe_available')();
      
      expect(result).toBe(true);
    });

    it('should mock get_ffmpeg_output_formats', async () => {
      const result = await tauriMocks.getMock('get_ffmpeg_output_formats')();
      
      expect(result).toEqual([
        { name: 'mp4', description: 'MP4 format', extensions: ['mp4'] },
        { name: 'mkv', description: 'Matroska format', extensions: ['mkv'] }
      ]);
    });

    it('should handle FFmpeg not available scenario', () => {
      tauriMocks.createErrorScenarios();
      
      const ffmpegAvailableMock = tauriMocks.getMock('check_ffmpeg_available');
      expect(ffmpegAvailableMock).toBeDefined();
    });
  });

  describe('File System Commands', () => {
    it('should mock get_file_info', async () => {
      const result = await tauriMocks.getMock('get_file_info')({ path: '/test/file.txt' });
      
      expect(result).toEqual({ size: 104857600 });
    });

    it('should mock open_file', async () => {
      await expectAsync(
        tauriMocks.getMock('open_file')({ path: '/test/video.mp4' })
      ).toBeResolved();
    });

    it('should mock open_folder', async () => {
      await expectAsync(
        tauriMocks.getMock('open_folder')({ path: '/test/folder' })
      ).toBeResolved();
    });
  });

  describe('Window Commands', () => {
    it('should mock minimize_window', async () => {
      await expectAsync(
        tauriMocks.getMock('minimize_window')()
      ).toBeResolved();
    });

    it('should mock maximize_window', async () => {
      await expectAsync(
        tauriMocks.getMock('maximize_window')()
      ).toBeResolved();
    });

    it('should mock close_window', async () => {
      await expectAsync(
        tauriMocks.getMock('close_window')()
      ).toBeResolved();
    });

    it('should mock start_dragging', async () => {
      await expectAsync(
        tauriMocks.getMock('start_dragging')()
      ).toBeResolved();
    });

    it('should mock is_maximized', async () => {
      const result = await tauriMocks.getMock('is_maximized')();
      
      expect(result).toBeFalse();
    });
  });

  describe('Global Mock Management', () => {
    it('should setup global mocks correctly', () => {
      const globalObject = (globalThis as any) || (window as any);
      
      expect(globalObject.mockTauriInvoke).toBeDefined();
      expect(globalObject.__TAURI__).toBeDefined();
      expect(globalObject.__TAURI__.plugins).toBeDefined();
      expect(globalObject.__TAURI__.plugins.notification).toBeDefined();
      expect(globalObject.__TAURI__.plugins.dialog).toBeDefined();
      expect(globalObject.__TAURI__.plugins.fs).toBeDefined();
    });

    it('should cleanup global mocks correctly', () => {
      tauriMocks.cleanupGlobalMocks();
      const globalObject = (globalThis as any) || (window as any);
      
      expect(globalObject.mockTauriInvoke).toBeUndefined();
      expect(globalObject.__TAURI__).toBeUndefined();
    });

    it('should reset all mocks', () => {
      const mock = tauriMocks.getMock('get_video_metadata');
      mock(); // Call the mock
      
      expect(mock.calls.count()).toBe(1);
      
      tauriMocks.resetAllMocks();
      
      expect(mock.calls.count()).toBe(0);
    });

    it('should allow setting custom mocks', () => {
      const customMock = jasmine.createSpy('customMock').and.returnValue('custom result');
      
      tauriMocks.setMock('custom_command', customMock);
      
      const retrievedMock = tauriMocks.getMock('custom_command');
      expect(retrievedMock).toBe(customMock);
    });

    it('should throw error for unknown command', () => {
      expect(() => {
        tauriMocks.getMock('unknown_command');
      }).toThrowError('No mock found for command: unknown_command');
    });
  });

  describe('Plugin Mocks', () => {
    it('should mock notification plugin', async () => {
      const globalObject = (globalThis as any) || (window as any);
      
      await globalObject.__TAURI__.plugins.notification.sendNotification({
        title: 'Test',
        body: 'Test notification'
      });
      
      expect(globalObject.__TAURI__.plugins.notification.sendNotification).toHaveBeenCalledWith({
        title: 'Test',
        body: 'Test notification'
      });
    });

    it('should mock dialog plugin', async () => {
      const globalObject = (globalThis as any) || (window as any);
      
      const result = await globalObject.__TAURI__.plugins.dialog.open({
        multiple: true,
        filters: [{ name: 'Video', extensions: ['mp4', 'mkv'] }]
      });
      
      expect(result).toEqual(['test-file.mp4']);
    });

    it('should mock fs plugin', async () => {
      const globalObject = (globalThis as any) || (window as any);
      
      const result = await globalObject.__TAURI__.plugins.fs.readDir('/test/path');
      
      expect(result).toEqual([
        { name: 'video1.mp4', isFile: true },
        { name: 'video2.mkv', isFile: true }
      ]);
    });
  });

  describe('Progress Event Simulation', () => {
    it('should simulate progress events', (done) => {
      const videoPath = '/test/video.mp4';
      let eventCount = 0;
      
      // Mock event listener
      const globalObject = (globalThis as any) || (window as any);
      globalObject.mockEventListener = jasmine.createSpy('mockEventListener').and.callFake((event, data) => {
        if (event === 'conversion_progress') {
          eventCount++;
          expect(data.payload.video_path).toBe(videoPath);
          expect(data.payload.progress).toBeDefined();
          expect(data.payload.progress.progress).toBeGreaterThanOrEqual(0);
          expect(data.payload.progress.progress).toBeLessThanOrEqual(1);
          
          if (eventCount === 6) { // 5 steps + 1 final
            done();
          }
        }
      });
      
      tauriMocks.simulateProgressEvents(videoPath, 5);
    });

    it('should handle missing event listener gracefully', () => {
      const globalObject = (globalThis as any) || (window as any);
      delete globalObject.mockEventListener;
      
      expect(() => {
        tauriMocks.simulateProgressEvents('/test/video.mp4', 3);
      }).not.toThrow();
    });
  });

  describe('Mock Data Validation', () => {
    it('should have valid mock video metadata', () => {
      expect(mockVideoMetadata).toBeDefined();
      expect(mockVideoMetadata.path).toBeTruthy();
      expect(mockVideoMetadata.name).toBeTruthy();
      expect(mockVideoMetadata.size).toBeGreaterThan(0);
      expect(mockVideoMetadata.audio_tracks).toBeInstanceOf(Array);
      expect(mockVideoMetadata.subtitle_tracks).toBeInstanceOf(Array);
    });

    it('should have valid mock conversion result', () => {
      expect(mockConversionResult).toBeDefined();
      expect(mockConversionResult.success).toBeTrue();
      expect(mockConversionResult.output_path).toBeTruthy();
      expect(mockConversionResult.duration).toBeGreaterThan(0);
    });
  });

  describe('Error Scenarios', () => {
    it('should create error scenarios correctly', () => {
      tauriMocks.createErrorScenarios();
      
      // Test video metadata error
      tauriMocks.getMock('get_video_metadata')().then((result: any) => {
        expect(result.error).toBe('FFprobe failed');
      });
      
      // Test conversion error
      tauriMocks.getMock('start_video_conversion')().then((result: any) => {
        expect(result.success).toBeFalse();
        expect(result.error).toBe('FFmpeg not found');
      });
      
      // Test FFmpeg availability
      tauriMocks.getMock('check_ffmpeg_available')().then((result: any) => {
        expect(result).toBeFalse();
      });
    });
  });
});