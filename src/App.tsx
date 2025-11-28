import { DragDropZone } from "./components/DragDropZone";
import { SettingsDialog } from "./components/SettingsDialog";
import { ThemeProvider } from "./components/theme-provider";
import { ModeToggle } from "./components/mode-toggle";

function App() {
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
