import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { DragDropZone } from "./components/DragDropZone";
import { SettingsDialog } from "./components/SettingsDialog";
import { ThemeProvider } from "./components/theme-provider";
import { TitleBar } from "./components/TitleBar";
import { useVideoStore } from "./store/videoStore";

function App() {
  const updateProgress = useVideoStore((state) => state.updateProgress);
  const files = useVideoStore((state) => state.files);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Detect Windows and apply Windows 11 radius
  useEffect(() => {
    const isWindows = navigator.platform.toLowerCase().includes('win') || 
                     navigator.userAgent.toLowerCase().includes('windows');
    if (isWindows) {
      document.documentElement.classList.add('windows');
    }
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
      <div className="flex flex-col h-screen bg-background/95 text-foreground transition-colors duration-300 rounded-xl border border-border overflow-hidden">
        <TitleBar onSettingsClick={() => setIsSettingsOpen(true)} />
        <div className="flex-1 overflow-auto p-8 bg-transparent">
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
