import { Minimize2, Maximize2, X, Settings, Moon, Sun, Monitor } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTheme } from './theme-provider';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

interface TitleBarProps {
  onSettingsClick: () => void;
}

export function TitleBar({ onSettingsClick }: TitleBarProps) {
  const { theme, setTheme } = useTheme();
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setIsThemeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMinimize = async () => {
    const appWindow = await getCurrentWindow();
    await appWindow.minimize();
  };

  const handleMaximize = async () => {
    const appWindow = await getCurrentWindow();
    const isMaximized = await appWindow.isMaximized();
    if (isMaximized) {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
    }
  };

  const handleClose = async () => {
    const appWindow = await getCurrentWindow();
    await appWindow.close();
  };

  return (
    <div className="flex items-center justify-between h-10 bg-background/25 border-b border-border/30 select-none cursor-grab">
      <div className="flex items-center gap-2 flex-1" data-tauri-drag-region>
        <h2 className="text-sm font-semibold text-foreground px-4">Video Optimizer</h2>
      </div>

      <div className="flex items-center gap-1">
        {/* Settings Button */}
        <button
          onClick={onSettingsClick}
          className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded transition-colors"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Theme Toggle */}
        <div className="relative" ref={themeRef}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsThemeOpen(!isThemeOpen)}
            className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded transition-colors"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait">
              {theme === 'dark' ? (
                <motion.div key="dark" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                  <Moon className="h-4 w-4" />
                </motion.div>
              ) : theme === 'light' ? (
                <motion.div key="light" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                  <Sun className="h-4 w-4" />
                </motion.div>
              ) : (
                <motion.div key="system" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                  <Monitor className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <AnimatePresence>
            {isThemeOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute top-10 right-0 p-1 bg-popover text-popover-foreground rounded-lg border shadow-lg flex flex-col min-w-[120px] z-50"
              >
                {[
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      setTheme(item.value as any);
                      setIsThemeOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors text-left ${theme === item.value
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted"
                      }`}
                  >
                    <item.icon className="w-3 h-3" />
                    {item.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={handleMinimize}
            className="w-10 h-10 flex items-center justify-center hover:bg-muted rounded transition-colors"
            aria-label="Minimize"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-10 h-10 flex items-center justify-center hover:bg-muted rounded transition-colors"
            aria-label="Maximize"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground rounded transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

