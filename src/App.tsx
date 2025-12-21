import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DragDropZone } from "./components/DragDropZone";
import { SettingsDialog } from "./components/SettingsDialog";
import { ThemeProvider } from "./components/theme-provider";
import { TitleBar } from "./components/TitleBar";
import { useVideoStore } from "./store/videoStore";

function App() {
  const updateProgress = useVideoStore((state) => state.updateProgress);
  const files = useVideoStore((state) => state.files);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Apply Windows blur effect on mount
  useEffect(() => {
    const applyBlur = async () => {
      try {
        const appWindow = getCurrentWindow();
        // The command receives the window automatically from Tauri
        await invoke("apply_window_blur");
      } catch (error) {
        // Silently fail if blur is not supported (e.g., on non-Windows)
        console.debug("Blur effect not available:", error);
      }
    };
    // Apply blur after a short delay to ensure window is fully initialized
    const timer = setTimeout(() => {
      applyBlur();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unlisten = listen('conversion_progress', (event: any) => {
      // TODO: We need to know WHICH file is converting.
      // For now, let's assume the first 'converting' file or just the first file for demo
      // In a real app, the event should contain the file ID or we track the active conversion ID
      const activeFile = files.find(f => f.status === 'converting');
      if (activeFile) {
        updateProgress(activeFile.id, event.payload.progress);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [files, updateProgress]);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="flex flex-col h-screen bg-background text-foreground transition-colors duration-300">
        <TitleBar onSettingsClick={() => setIsSettingsOpen(true)} />
        <div className="flex-1 overflow-auto p-8">
          <SettingsDialog isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
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
