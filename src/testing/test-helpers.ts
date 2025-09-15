// Test helper utilities

import { ComponentFixture } from '@angular/core/testing';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

/**
 * Helper to wait for async operations in tests
 */
export function waitForAsync(ms: number = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to trigger change detection and wait for stability
 */
export async function detectChangesAndWait(fixture: ComponentFixture<any>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

/**
 * Helper to find element by CSS selector
 */
export function findElement<T>(fixture: ComponentFixture<T>, selector: string): DebugElement | null {
  return fixture.debugElement.query(By.css(selector));
}

/**
 * Helper to find all elements by CSS selector
 */
export function findElements<T>(fixture: ComponentFixture<T>, selector: string): DebugElement[] {
  return fixture.debugElement.queryAll(By.css(selector));
}

/**
 * Helper to get element text content
 */
export function getElementText<T>(fixture: ComponentFixture<T>, selector: string): string {
  const element = findElement(fixture, selector);
  return element ? element.nativeElement.textContent.trim() : '';
}

/**
 * Helper to click an element
 */
export function clickElement<T>(fixture: ComponentFixture<T>, selector: string): void {
  const element = findElement(fixture, selector);
  if (element) {
    element.nativeElement.click();
    fixture.detectChanges();
  }
}

/**
 * Helper to simulate input value change
 */
export function setInputValue<T>(fixture: ComponentFixture<T>, selector: string, value: string): void {
  const element = findElement(fixture, selector);
  if (element) {
    const inputElement = element.nativeElement;
    inputElement.value = value;
    inputElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
}

/**
 * Helper to create mock signal
 */
export function createMockSignal<T>(initialValue: T) {
  let value = initialValue;
  const signal = jasmine.createSpy('signal').and.callFake(() => value) as any;
  signal.set = jasmine.createSpy('set').and.callFake((newValue: T) => {
    value = newValue;
  });
  signal.update = jasmine.createSpy('update').and.callFake((updateFn: (current: T) => T) => {
    value = updateFn(value);
  });
  return signal;
}

/**
 * Helper to create mock Observable
 */
export function createMockObservable<T>(value: T) {
  return {
    subscribe: jasmine.createSpy('subscribe').and.callFake((callback: (value: T) => void) => {
      callback(value);
      return { unsubscribe: jasmine.createSpy('unsubscribe') };
    }),
    pipe: jasmine.createSpy('pipe').and.returnValue({
      subscribe: jasmine.createSpy('subscribe').and.callFake((callback: (value: T) => void) => {
        callback(value);
        return { unsubscribe: jasmine.createSpy('unsubscribe') };
      })
    })
  };
}

/**
 * Spy on console methods for testing
 */
export function spyOnConsole() {
  return {
    error: spyOn(console, 'error'),
    warn: spyOn(console, 'warn'),
    log: spyOn(console, 'log'),
    info: spyOn(console, 'info')
  };
}

/**
 * Mock file object for testing file operations
 */
export function createMockFile(name: string, size: number = 1024, type: string = 'video/mp4'): File {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/**
 * Mock FileList for testing file selection
 */
export function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      for (let i = 0; i < files.length; i++) {
        yield files[i];
      }
    }
  };
  
  // Add indexed access
  files.forEach((file, index) => {
    (fileList as any)[index] = file;
  });
  
  return fileList as FileList;
}

/**
 * Helper to mock video file data
 */
export function createMockVideoFile(overrides: Partial<any> = {}) {
  return {
    path: '/test/video.mp4',
    name: 'video.mp4',
    size: 104857600,
    duration: 3600,
    resolution: '1920x1080',
    codec: 'h264',
    bitrate: 5000000,
    fps: 30,
    audio_tracks: [
      { index: 0, codec: 'aac', language: 'en', channels: 2 }
    ],
    subtitle_tracks: [],
    loading: false,
    error: undefined,
    movieInfo: undefined,
    ...overrides
  };
}

/**
 * Helper to create mock conversion config
 */
export function createMockConversionConfig(overrides: Partial<any> = {}) {
  return {
    format: 'mkv' as 'mp4' | 'mkv' | 'avi' | 'mov',
    quality: '1080p' as '1080p' | '720p' | '480p' | '4K',
    codec: 'h265' as 'h264' | 'h265' | 'vp9' | 'av1',
    audio: 'aac' as 'aac' | 'ac3' | 'mp3' | 'opus',
    crf: 20,
    group: 'VideoOptimizer',
    ...overrides
  };
}

/**
 * Helper to create mock conversion queue item
 */
export function createMockQueueItem(overrides: Partial<any> = {}) {
  return {
    video: createMockVideoFile(),
    config: createMockConversionConfig(),
    selectedAudioTracks: [0],
    selectedSubtitleTracks: [],
    status: 'pending' as const,
    progress: null,
    result: null,
    error: undefined,
    ...overrides
  };
}