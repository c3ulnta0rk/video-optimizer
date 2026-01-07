
import { useEffect, useState } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { DragDropZone } from "./components/DragDropZone";
import { SettingsDialog } from "./components/SettingsDialog";
import { ThemeProvider } from "./components/theme-provider";
import { TitleBar } from "./components/TitleBar";
import { TrayPopup } from "./components/TrayPopup";
import { CloseBehaviorDialog } from "./components/CloseBehaviorDialog";
import { useVideoStore } from "./store/videoStore";

function App() {
  const updateProgress = useVideoStore((state) => state.updateProgress);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTrayWindow, setIsTrayWindow] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);

  const handleCloseConfirm = async (action: 'minimize' | 'quit', remember: boolean) => {
    setIsCloseDialogOpen(false);
    const appWindow = getCurrentWindow();

    if (remember) {
      localStorage.setItem('closeAction', action);
    }

    if (action === 'minimize') {
      await appWindow.hide();
    } else {
      await invoke("quit_app_command");
    }
  };

  useEffect(() => {
    invoke("log_frontend", { message: "App mounted, hash: " + window.location.hash });
    if (window.location.hash === "#tray") {
      invoke("log_frontend", { message: "Tray mode detected" });
      setIsTrayWindow(true);
      document.documentElement.classList.add("dark"); // Force dark mode for tray
    }
  }, []);

  // Detect Windows and apply Windows 11 radius
  useEffect(() => {
    const isWindows = navigator.platform.toLowerCase().includes('win') ||
      navigator.userAgent.toLowerCase().includes('windows');
    if (isWindows) {
      document.documentElement.classList.add('windows');
    }
  }, []);

  // Handle Close Request
  useEffect(() => {
    if (isTrayWindow) return; // Don't block tray window close

    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onCloseRequested(async (event) => {
      const converting = useVideoStore.getState().files.some(f => f.status === 'converting');

      if (converting) {
        event.preventDefault();

        const savedAction = localStorage.getItem('closeAction');
        if (savedAction === 'minimize') {
          await appWindow.hide();
        } else if (savedAction === 'quit') {
          await invoke("quit_app_command");
        } else {
          setIsCloseDialogOpen(true);
        }
      }
      // If not converting, default close happens
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [isTrayWindow]);


  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenSyncRequest: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenProgress = await listen('conversion_progress', (event: any) => {
        // The event payload contains the file ID, use it directly
        if (event.payload?.id) {
          updateProgress(event.payload.id, event.payload.progress, {
            timeRemaining: event.payload.time_remaining,
            speed: event.payload.speed,
            fps: event.payload.fps
          });
        }
      });

      // Only Main Window listens for sync requests
      if (window.location.hash !== "#tray") {
        unlistenSyncRequest = await listen('request_tray_sync', async () => {
          console.log("Received request_tray_sync from Tray");
          const state = useVideoStore.getState();
          // Emit full state to the tray
          await emit('tray_sync_state', { files: state.files });
          invoke("log_frontend", { message: `Main window emitted sync state with ${state.files.length} files` });
        });

        // Also emit sync state proactively when hiding? 
        // Not strictly needed if Tray requests on mount, but good for updates.
        // Actually, store updates don't trigger this useEffect. 
        // So Tray only gets snapshot on mount.
        // This is fine for now. If files added/removed, Tray won't know until restart or reopen?
        // Ideally we should sync on any store change.
        // But let's start with initial sync.
      }
    };

    setupListeners();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenSyncRequest) unlistenSyncRequest();
    };
  }, [updateProgress]);

  if (isTrayWindow) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <TrayPopup />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="flex flex-col h-screen bg-background/95 text-foreground transition-colors duration-300 rounded-xl border border-border overflow-hidden">
        <TitleBar onSettingsClick={() => setIsSettingsOpen(true)} />
        <div className="flex-1 overflow-auto p-8 bg-transparent">
          <SettingsDialog isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
          <CloseBehaviorDialog
            isOpen={isCloseDialogOpen}
            onClose={() => setIsCloseDialogOpen(false)}
            onConfirm={handleCloseConfirm}
          />
          <header className="mb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight mb-2">Video Optimizer</h1>
            <p className="text-muted-foreground">Premium video conversion tool</p>
          </header>

          <main>
            <DragDropZone />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
