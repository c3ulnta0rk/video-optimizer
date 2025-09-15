// Mock for @tauri-apps/api/core
let mockInvokeImplementation = (command: string, args?: any): Promise<any> => {
  return Promise.resolve();
};

export const invoke = jasmine.createSpy('invoke').and.callFake(mockInvokeImplementation);

// Function to set custom mock implementation
(global as any).__setTauriInvokeMock = (implementation: any) => {
  mockInvokeImplementation = implementation;
  invoke.and.callFake(implementation);
};