import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { DragDropZone } from "./components/DragDropZone";
import { SettingsDialog } from "./components/SettingsDialog";
import { ThemeProvider } from "./components/theme-provider";
import { TitleBar } from "./components/TitleBar";
import { useVideoStore } from "./store/videoStore";

function App() {
  const updateProgress = useVideoStore((state) => state.updateProgress);
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
      // The event payload contains the file ID, use it directly
      if (event.payload?.id) {
        updateProgress(event.payload.id, event.payload.progress);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [updateProgress]);

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
