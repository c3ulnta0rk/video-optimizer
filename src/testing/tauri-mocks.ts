// Mock utilities for Tauri commands in tests

export interface MockVideoMetadata {
  path: string;
  name: string;
  size: number;
  duration?: number;
  resolution?: string;
  codec?: string;
  bitrate?: number;
  fps?: number;
  audio_tracks?: any[];
  subtitle_tracks?: any[];
  error?: string;
}

export interface MockConversionResult {
  success: boolean;
  output_path?: string;
  error?: string;
  duration: number;
}

export interface MockConversionProgress {
  progress: number;
  current_time: number;
  total_time: number;
  speed: number;
  eta: number;
  status: string;
}

// Default mock data
export const mockVideoMetadata: MockVideoMetadata = {
  path: '/test/video.mp4',
  name: 'video.mp4',
  size: 104857600, // 100MB
  duration: 3600, // 1 hour
  resolution: '1920x1080',
  codec: 'h264',
  bitrate: 5000000,
  fps: 30,
  audio_tracks: [
    { index: 0, codec: 'aac', language: 'en', channels: 2 }
  ],
  subtitle_tracks: []
};

export const mockConversionResult: MockConversionResult = {
  success: true,
  output_path: '/test/output.mkv',
  duration: 120
};

export const mockConversionProgress: MockConversionProgress = {
  progress: 0.5,
  current_time: 1800,
  total_time: 3600,
  speed: 2.5,
  eta: 720,
  status: 'Converting'
};

// Mock Tauri invoke function
export class TauriMockService {
  private mocks = new Map<string, jasmine.Spy>();

  constructor() {
    this.setupDefaultMocks();
  }

  private setupDefaultMocks(): void {
    // Video commands
    this.mocks.set('get_video_metadata', 
      jasmine.createSpy('get_video_metadata').and.returnValue(Promise.resolve(mockVideoMetadata)));
    
    this.mocks.set('start_video_conversion', 
      jasmine.createSpy('start_video_conversion').and.returnValue(Promise.resolve(mockConversionResult)));
    
    this.mocks.set('stop_video_conversion', 
      jasmine.createSpy('stop_video_conversion').and.returnValue(Promise.resolve(true)));
    
    this.mocks.set('cleanup_ffmpeg_processes', 
      jasmine.createSpy('cleanup_ffmpeg_processes').and.returnValue(Promise.resolve()));
    
    // FFmpeg commands
    this.mocks.set('check_ffmpeg_available', 
      jasmine.createSpy('check_ffmpeg_available').and.returnValue(Promise.resolve(true)));
    
    this.mocks.set('check_ffprobe_available', 
      jasmine.createSpy('check_ffprobe_available').and.returnValue(Promise.resolve(true)));
    
    this.mocks.set('get_ffmpeg_output_formats', 
      jasmine.createSpy('get_ffmpeg_output_formats').and.returnValue(Promise.resolve([
        { name: 'mp4', description: 'MP4 format', extensions: ['mp4'] },
        { name: 'mkv', description: 'Matroska format', extensions: ['mkv'] }
      ])));
    
    // File system commands
    this.mocks.set('get_file_info', 
      jasmine.createSpy('get_file_info').and.returnValue(Promise.resolve({ size: 104857600 })));
    
    this.mocks.set('open_file', 
      jasmine.createSpy('open_file').and.returnValue(Promise.resolve()));
    
    this.mocks.set('open_folder', 
      jasmine.createSpy('open_folder').and.returnValue(Promise.resolve()));
    
    // Window commands
    this.mocks.set('minimize_window', 
      jasmine.createSpy('minimize_window').and.returnValue(Promise.resolve()));
    
    this.mocks.set('maximize_window', 
      jasmine.createSpy('maximize_window').and.returnValue(Promise.resolve()));
    
    this.mocks.set('close_window', 
      jasmine.createSpy('close_window').and.returnValue(Promise.resolve()));
    
    this.mocks.set('start_dragging', 
      jasmine.createSpy('start_dragging').and.returnValue(Promise.resolve()));
    
    this.mocks.set('is_maximized', 
      jasmine.createSpy('is_maximized').and.returnValue(Promise.resolve(false)));
  }

  /**
   * Get a mock for a specific Tauri command
   */
  getMock(command: string): jasmine.Spy {
    const mock = this.mocks.get(command);
    if (!mock) {
      throw new Error(`No mock found for command: ${command}`);
    }
    return mock;
  }

  /**
   * Set up a custom mock for a command
   */
  setMock(command: string, mock: jasmine.Spy): void {
    this.mocks.set(command, mock);
  }

  /**
   * Reset all mocks
   */
  resetAllMocks(): void {
    this.mocks.forEach(mock => mock.calls.reset());
  }

  /**
   * Setup mock Tauri invoke function globally
   */
  setupGlobalMocks(): void {
    const globalObject = (globalThis as any) || (window as any);
    
    // Mock the global invoke function to use our mock system
    const invokeMock = jasmine.createSpy('invoke').and.callFake(
      (command: string, args?: any) => {
        const mock = this.mocks.get(command);
        if (mock) {
          return mock(args);
        }
        console.warn(`No mock found for Tauri command: ${command}`);
        return Promise.reject(`Command not mocked: ${command}`);
      }
    );
    
    // Set both the global invoke and mockTauriInvoke
    globalObject.invoke = invokeMock;
    globalObject.mockTauriInvoke = invokeMock;

    // Mock Tauri plugins
    globalObject.__TAURI__ = {
      plugins: {
        notification: {
          sendNotification: jasmine.createSpy('sendNotification').and.returnValue(Promise.resolve())
        },
        dialog: {
          open: jasmine.createSpy('open').and.returnValue(Promise.resolve(['test-file.mp4']))
        },
        fs: {
          readDir: jasmine.createSpy('readDir').and.returnValue(Promise.resolve([
            { name: 'video1.mp4', isFile: true },
            { name: 'video2.mkv', isFile: true }
          ]))
        }
      }
    };
  }

  /**
   * Cleanup global mocks
   */
  cleanupGlobalMocks(): void {
    const globalObject = (globalThis as any) || (window as any);
    delete globalObject.mockTauriInvoke;
    delete globalObject.__TAURI__;
  }

  /**
   * Simulate conversion progress events
   */
  simulateProgressEvents(videoPath: string, steps: number = 5): void {
    const globalObject = (globalThis as any) || (window as any);
    const eventListener = globalObject.mockEventListener;
    if (!eventListener) return;

    for (let i = 0; i <= steps; i++) {
      setTimeout(() => {
        const progress = i / steps;
        eventListener('conversion_progress', {
          payload: {
            video_path: videoPath,
            progress: {
              ...mockConversionProgress,
              progress,
              current_time: mockConversionProgress.total_time * progress,
              eta: mockConversionProgress.total_time * (1 - progress)
            }
          }
        });
      }, i * 100);
    }
  }

  /**
   * Create error scenarios for testing
   */
  createErrorScenarios(): void {
    this.mocks.set('get_video_metadata', 
      jasmine.createSpy('get_video_metadata').and.returnValue(
        Promise.resolve({ ...mockVideoMetadata, error: 'FFprobe failed' })
      ));
    
    this.mocks.set('start_video_conversion', 
      jasmine.createSpy('start_video_conversion').and.returnValue(
        Promise.resolve({ success: false, error: 'FFmpeg not found', duration: 0 })
      ));
    
    this.mocks.set('check_ffmpeg_available', 
      jasmine.createSpy('check_ffmpeg_available').and.returnValue(Promise.resolve(false)));
  }
}

// Export singleton instance
export const tauriMocks = new TauriMockService();