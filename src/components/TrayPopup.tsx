import { useVideoStore } from "../store/videoStore";
import { useEffect } from "react";
import { emit, listen } from "@tauri-apps/api/event";

export function TrayPopup() {
    const files = useVideoStore(state => state.files.filter(f => f.status === 'converting'));

    useEffect(() => {
        let unlistenSync: (() => void) | undefined;

        const setupSync = async () => {
            unlistenSync = await listen('tray_sync_state', (event: any) => {
                if (event.payload && event.payload.files) {
                    // Update the store with synced files
                    // We only want to update if there are changes to avoid jitter?
                    // Zustand setState is efficient.
                    // Note: This replaces ALL files. Main window is source of truth.
                    useVideoStore.setState({ files: event.payload.files });
                }
            });

            // Initial Request
            await emit('request_tray_sync');
        };

        setupSync();

        // Poll every 2 seconds to keep list synchronized (in case files are added/removed)
        const interval = setInterval(() => {
            emit('request_tray_sync');
        }, 2000);

        return () => {
            if (unlistenSync) unlistenSync();
            clearInterval(interval);
        };
    }, []);

    if (files.length === 0) {
        return (
            <div className="h-screen w-screen bg-zinc-950 text-white flex items-center justify-center text-xs border border-zinc-800">
                <p>No active conversions</p>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-zinc-950 text-white p-3 overflow-y-auto border border-zinc-800 select-none cursor-default">
            <div className="mb-3 font-semibold text-xs text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                <span>Conversions in Progress</span>
                <span className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-[10px]">{files.length}</span>
            </div>

            <div className="space-y-3">
                {files.map(file => (
                    <div key={file.id} className="group">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-medium truncate max-w-[180px]" title={file.name}>
                                {file.name}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400 ml-2">
                                {file.progress.toFixed(1)}%
                            </span>
                        </div>

                        <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden mb-1.5 ring-1 ring-zinc-800">
                            <div
                                className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${file.progress}%` }}
                            />
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                            <div className="flex gap-2">
                                {file.speed && <span>{file.speed}</span>}
                                {file.fps && <span>{Math.round(file.fps)} fps</span>}
                            </div>
                            <span>{file.timeRemaining?.split('.')[0] || '--:--:--'}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
