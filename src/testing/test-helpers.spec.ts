import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import {
  waitForAsync,
  detectChangesAndWait,
  findElement,
  findElements,
  getElementText,
  clickElement,
  setInputValue,
  createMockSignal,
  createMockObservable,
  spyOnConsole,
  createMockFile,
  createMockFileList,
  createMockVideoFile,
  createMockConversionConfig,
  createMockQueueItem
} from './test-helpers';

// Test component for DOM helpers
@Component({
  standalone: true,
  template: `
    <div id="test-div" class="test-class">Test Content</div>
    <button id="test-button" (click)="onClick()">Click Me</button>
    <input id="test-input" type="text" (input)="onInput($event)" />
    <div class="multiple-items">Item 1</div>
    <div class="multiple-items">Item 2</div>
    <div class="multiple-items">Item 3</div>
    <span>{{ testSignal() }}</span>
  `
})
class TestComponent {
  testSignal = signal('initial value');
  clickCount = 0;
  inputValue = '';

  onClick() {
    this.clickCount++;
  }

  onInput(event: any) {
    this.inputValue = event.target.value;
  }
}

describe('Test Helpers', () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Async Utilities', () => {
    it('should wait for specified time', async () => {
      const start = Date.now();
      await waitForAsync(100);
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(100);
    });

    it('should wait with default time', async () => {
      const start = Date.now();
      await waitForAsync();
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(0);
    });

    it('should detect changes and wait', async () => {
      component.testSignal.set('updated value');
      
      await detectChangesAndWait(fixture);
      
      const spanElement = fixture.debugElement.query(By.css('span'));
      expect(spanElement.nativeElement.textContent).toBe('updated value');
    });
  });

  describe('DOM Query Helpers', () => {
    it('should find element by CSS selector', () => {
      const element = findElement(fixture, '#test-div');
      
      expect(element).toBeTruthy();
      expect(element?.nativeElement.id).toBe('test-div');
      expect(element?.nativeElement.className).toBe('test-class');
    });

    it('should return null for non-existent element', () => {
      const element = findElement(fixture, '#non-existent');
      
      expect(element).toBeNull();
    });

    it('should find all elements by CSS selector', () => {
      const elements = findElements(fixture, '.multiple-items');
      
      expect(elements).toHaveSize(3);
      expect(elements[0].nativeElement.textContent).toBe('Item 1');
      expect(elements[1].nativeElement.textContent).toBe('Item 2');
      expect(elements[2].nativeElement.textContent).toBe('Item 3');
    });

    it('should return empty array for non-existent elements', () => {
      const elements = findElements(fixture, '.non-existent');
      
      expect(elements).toHaveSize(0);
    });
  });

  describe('Text and Interaction Helpers', () => {
    it('should get element text content', () => {
      const text = getElementText(fixture, '#test-div');
      
      expect(text).toBe('Test Content');
    });

    it('should return empty string for non-existent element', () => {
      const text = getElementText(fixture, '#non-existent');
      
      expect(text).toBe('');
    });

    it('should click element and trigger event', () => {
      expect(component.clickCount).toBe(0);
      
      clickElement(fixture, '#test-button');
      
      expect(component.clickCount).toBe(1);
    });

    it('should handle click on non-existent element gracefully', () => {
      expect(() => {
        clickElement(fixture, '#non-existent');
      }).not.toThrow();
    });

    it('should set input value and trigger event', () => {
      expect(component.inputValue).toBe('');
      
      setInputValue(fixture, '#test-input', 'test value');
      
      expect(component.inputValue).toBe('test value');
    });

    it('should handle set input value on non-existent element gracefully', () => {
      expect(() => {
        setInputValue(fixture, '#non-existent', 'test value');
      }).not.toThrow();
    });
  });

  describe('Mock Signal', () => {
    it('should create mock signal with initial value', () => {
      const mockSignal = createMockSignal('initial');
      
      expect(mockSignal()).toBe('initial');
      expect(mockSignal).toHaveBeenCalled();
    });

    it('should allow setting signal value', () => {
      const mockSignal = createMockSignal('initial');
      
      mockSignal.set('updated');
      
      expect(mockSignal()).toBe('updated');
      expect(mockSignal.set).toHaveBeenCalledWith('updated');
    });

    it('should allow updating signal value', () => {
      const mockSignal = createMockSignal(10);
      
      mockSignal.update((current: number) => current + 5);
      
      expect(mockSignal()).toBe(15);
      expect(mockSignal.update).toHaveBeenCalledWith(jasmine.any(Function));
    });
  });

  describe('Mock Observable', () => {
    it('should create mock observable that emits value', () => {
      const mockObservable = createMockObservable('test value');
      let receivedValue: string | undefined;
      
      const subscription = mockObservable.subscribe((value: any) => {
        receivedValue = value;
      });
      
      expect(receivedValue).toBe('test value');
      expect(subscription.unsubscribe).toBeDefined();
    });

    it('should support pipe operations', () => {
      const mockObservable = createMockObservable('test value');
      let receivedValue: string | undefined;
      
      const pipedObservable = mockObservable.pipe();
      const subscription = pipedObservable.subscribe((value: any) => {
        receivedValue = value;
      });
      
      expect(receivedValue).toBe('test value');
      expect(subscription.unsubscribe).toBeDefined();
    });
  });

  describe('Console Spies', () => {
    it('should spy on console methods', () => {
      const consoleSpies = spyOnConsole();
      
      console.error('test error');
      console.warn('test warning');
      console.log('test log');
      console.info('test info');
      
      expect(consoleSpies.error).toHaveBeenCalledWith('test error');
      expect(consoleSpies.warn).toHaveBeenCalledWith('test warning');
      expect(consoleSpies.log).toHaveBeenCalledWith('test log');
      expect(consoleSpies.info).toHaveBeenCalledWith('test info');
    });
  });

  describe('Mock File Creation', () => {
    it('should create mock file with default values', () => {
      const file = createMockFile('test.mp4');
      
      expect(file.name).toBe('test.mp4');
      expect(file.size).toBe(1024);
      expect(file.type).toBe('video/mp4');
    });

    it('should create mock file with custom values', () => {
      const file = createMockFile('custom.mkv', 2048, 'video/x-matroska');
      
      expect(file.name).toBe('custom.mkv');
      expect(file.size).toBe(2048);
      expect(file.type).toBe('video/x-matroska');
    });

    it('should create mock FileList', () => {
      const files = [
        createMockFile('video1.mp4'),
        createMockFile('video2.mkv')
      ];
      const fileList = createMockFileList(files);
      
      expect(fileList.length).toBe(2);
      expect(fileList.item(0)?.name).toBe('video1.mp4');
      expect(fileList.item(1)?.name).toBe('video2.mkv');
      expect(fileList[0].name).toBe('video1.mp4');
      expect(fileList[1].name).toBe('video2.mkv');
    });

    it('should create empty FileList', () => {
      const fileList = createMockFileList([]);
      
      expect(fileList.length).toBe(0);
      expect(fileList.item(0)).toBeNull();
    });

    it('should support FileList iteration', () => {
      const files = [
        createMockFile('video1.mp4'),
        createMockFile('video2.mkv')
      ];
      const fileList = createMockFileList(files);
      
      const fileNames: string[] = [];
      for (const file of fileList as any) {
        fileNames.push(file.name);
      }
      
      expect(fileNames).toEqual(['video1.mp4', 'video2.mkv']);
    });
  });

  describe('Mock Video File', () => {
    it('should create mock video file with default values', () => {
      const videoFile = createMockVideoFile();
      
      expect(videoFile.path).toBe('/test/video.mp4');
      expect(videoFile.name).toBe('video.mp4');
      expect(videoFile.size).toBe(104857600);
      expect(videoFile.duration).toBe(3600);
      expect(videoFile.resolution).toBe('1920x1080');
      expect(videoFile.codec).toBe('h264');
      expect(videoFile.bitrate).toBe(5000000);
      expect(videoFile.fps).toBe(30);
      expect(videoFile.audio_tracks).toHaveSize(1);
      expect(videoFile.subtitle_tracks).toHaveSize(0);
      expect(videoFile.loading).toBeFalse();
      expect(videoFile.error).toBeUndefined();
    });

    it('should create mock video file with overrides', () => {
      const overrides = {
        path: '/custom/path.mkv',
        name: 'custom.mkv',
        duration: 7200,
        resolution: '4096x2160',
        loading: true,
        error: 'Custom error'
      };
      const videoFile = createMockVideoFile(overrides);
      
      expect(videoFile.path).toBe('/custom/path.mkv');
      expect(videoFile.name).toBe('custom.mkv');
      expect(videoFile.duration).toBe(7200);
      expect(videoFile.resolution).toBe('4096x2160');
      expect(videoFile.loading).toBeTrue();
      expect(videoFile.error as any).toEqual('Custom error');
      // Verify default values are preserved
      expect(videoFile.codec).toBe('h264');
      expect(videoFile.bitrate).toBe(5000000);
    });
  });

  describe('Mock Conversion Config', () => {
    it('should create mock conversion config with default values', () => {
      const config = createMockConversionConfig();
      
      expect(config.format).toBe('mkv');
      expect(config.quality).toBe('1080p');
      expect(config.codec).toBe('h265');
      expect(config.audio).toBe('aac');
      expect(config.crf).toBe(20);
      expect(config.group).toBe('VideoOptimizer');
    });

    it('should create mock conversion config with overrides', () => {
      const overrides = {
        format: 'mp4' as 'mp4',
        quality: '4K' as '4K',
        codec: 'h264' as 'h264',
        crf: 18
      };
      const config = createMockConversionConfig(overrides);
      
      expect(config.format).toBe('mp4');
      expect(config.quality).toBe('4K');
      expect(config.codec).toBe('h264');
      expect(config.crf).toBe(18);
      // Verify default values are preserved
      expect(config.audio).toBe('aac');
      expect(config.group).toBe('VideoOptimizer');
    });
  });

  describe('Mock Queue Item', () => {
    it('should create mock queue item with default values', () => {
      const queueItem = createMockQueueItem();
      
      expect(queueItem.video).toBeDefined();
      expect(queueItem.config).toBeDefined();
      expect(queueItem.selectedAudioTracks).toEqual([0]);
      expect(queueItem.selectedSubtitleTracks).toEqual([]);
      expect(queueItem.status).toBe('pending');
      expect(queueItem.progress).toBeNull();
      expect(queueItem.result).toBeNull();
      expect(queueItem.error).toBeUndefined();
    });

    it('should create mock queue item with overrides', () => {
      const customVideo = createMockVideoFile({ path: '/custom/video.mp4' });
      const customConfig = createMockConversionConfig({ format: 'mp4' as 'mp4' });
      const overrides = {
        video: customVideo,
        config: customConfig,
        status: 'converting' as const,
        selectedAudioTracks: [1, 2],
        selectedSubtitleTracks: [0],
        error: 'Custom error'
      };
      const queueItem = createMockQueueItem(overrides);
      
      expect(queueItem.video.path).toBe('/custom/video.mp4');
      expect(queueItem.config.format).toBe('mp4');
      expect(queueItem.status).toBe('converting');
      expect(queueItem.selectedAudioTracks).toEqual([1, 2]);
      expect(queueItem.selectedSubtitleTracks).toEqual([0] as any);
      expect(queueItem.error as any).toEqual('Custom error');
    });
  });

  describe('Integration Tests', () => {
    it('should work together in complex scenarios', async () => {
      // Create mock data
      const mockSignal = createMockSignal('initial');
      const videoFile = createMockVideoFile({ name: 'integration-test.mp4' });
      const config = createMockConversionConfig({ format: 'mp4' as 'mp4' });
      
      // Setup console spy
      const consoleSpies = spyOnConsole();
      
      // Simulate component interaction
      component.testSignal.set('integration test');
      await detectChangesAndWait(fixture);
      
      // Test DOM interaction
      setInputValue(fixture, '#test-input', videoFile.name);
      expect(component.inputValue).toBe('integration-test.mp4');
      
      // Test click interaction
      clickElement(fixture, '#test-button');
      expect(component.clickCount).toBe(1);
      
      // Test text content
      const text = getElementText(fixture, 'span');
      expect(text).toBe('integration test');
      
      // Verify mock signal works
      mockSignal.set(config.format);
      expect(mockSignal()).toBe('mp4');
      
      // Test console logging
      console.log('Integration test complete');
      expect(consoleSpies.log).toHaveBeenCalledWith('Integration test complete');
    });
  });
});