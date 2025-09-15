/**
 * Polyfills for Angular 20 testing environment
 * This file includes polyfills needed by Angular and is loaded before the app.
 */

// Zone.js is required by Angular itself for change detection and async operations
import 'zone.js';
import 'zone.js/testing';

// Tauri global mocks for testing
const globalObject = (globalThis as any) || (window as any);

// Mock Tauri invoke function - will be overridden by tauri-mocks in tests
globalObject.invoke = globalObject.invoke || function(command: string, args?: any) {
  // Fallback that will be replaced by tauri-mocks test setup
  return Promise.resolve();
};

// Mock Tauri listen function  
globalObject.listen = globalObject.listen || function() {
  return Promise.resolve();
};

// Mock Tauri plugins
globalObject.__TAURI__ = globalObject.__TAURI__ || {
  plugins: {
    notification: {
      sendNotification: function() { return Promise.resolve(); }
    },
    dialog: {
      open: function() { return Promise.resolve(null); }
    },
    fs: {
      readDir: function() { return Promise.resolve([]); }
    }
  }
};