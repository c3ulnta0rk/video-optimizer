import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { DragDropZone } from "./components/DragDropZone";
import { SettingsDialog } from "./components/SettingsDialog";
import { ThemeProvider } from "./components/theme-provider";
import { ModeToggle } from "./components/mode-toggle";
import { useVideoStore } from "./store/videoStore";

function App() {
  const updateProgress = useVideoStore((state) => state.updateProgress);
  const files = useVideoStore((state) => state.files);

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
      <div className="min-h-screen bg-background text-foreground p-8 transition-colors duration-300">
        <SettingsDialog />
        <ModeToggle />
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Video Optimizer</h1>
          <p className="text-muted-foreground">Premium video conversion tool</p>
        </header>

        <main>
          <DragDropZone />
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
