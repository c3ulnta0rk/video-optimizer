import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileVideo, Trash2, Play, Settings as SettingsIcon, FolderOpen, Wand2, Search, Square } from 'lucide-react';
import { useVideoStore } from '../store/videoStore';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { Store } from '@tauri-apps/plugin-store';
import { MetadataSearchDialog } from './MetadataSearchDialog';

export const VideoList: React.FC = () => {
    const { files, removeFile, updateStatus, updateFileSettings, updateMetadata, updateProgress } = useVideoStore();
    const [expandedFileId, setExpandedFileId] = React.useState<string | null>(null);
    const [conversionDetails, setConversionDetails] = React.useState<Record<string, { fps: number, time: string, speed: string }>>({});

    // Metadata Search State
    const [searchDialogState, setSearchDialogState] = React.useState<{ isOpen: boolean, fileId: string | null, query: string }>({
        isOpen: false,
        fileId: null,
        query: ''
    });

    const [availablePresets, setAvailablePresets] = React.useState<any[]>([]);
    const [defaultPresetId, setDefaultPresetId] = React.useState<string>('default-high');

    React.useEffect(() => {
        const loadPresets = async () => {
            try {
                const store = await Store.load('settings.json');
                const presets = await store.get<any[]>('presets');
                const defId = await store.get<string>('default_preset_id');

                if (defId) setDefaultPresetId(defId);

                if (presets) {
                    setAvailablePresets(presets);
                } else {
                    // Fallback if not yet saved
                    setAvailablePresets([
                        { id: 'default-high', name: 'High Quality (H.264)', container: 'mp4' },
                        { id: 'fast-gpu', name: 'Fast GPU (NVENC)', container: 'mp4' }
                    ]);
                }
            } catch (e) {
                console.error("Failed to load presets", e);
            }
        };
        loadPresets();

        const unlisten = getCurrentWebview().listen('conversion_progress', (event: any) => {
            const payload = event.payload;
            // payload: { id, frame, fps, time, bitrate, speed, progress }
            if (payload.id) {
                updateProgress(payload.id, payload.progress);
                setConversionDetails(prev => ({
                    ...prev,
                    [payload.id]: {
                        fps: payload.fps,
                        time: payload.time,
                        speed: payload.speed
                    }
                }));
            }
        });

        return () => {
            unlisten.then(f => f());
        };
    }, []);

    const startConversion = async () => {
        try {
            const store = await Store.load('settings.json');
            const defaultPresetId = await store.get<string>('default_preset_id') || 'default-high';
            const presets = await store.get<any[]>('presets') || [];
            // We need to import DEFAULT_PRESETS or duplicate logic if store is empty, 
            // but store should have presets if saved. If not, use hardcoded fallback.
            // Ideally we should import DEFAULT_PRESETS from types/preset but dynamic import might be tricky if not exported.
            // Let's assume store has them or we fallback safely.

            const defaultPreset = presets.find((p: any) => p.id === defaultPresetId) || presets[0] || {
                video: { codec: 'libx264', preset: 'medium', crf: 23 },
                audio: { codec: 'aac', bitrate: '128k', strategy: 'first_track' },
                subtitle: { strategy: 'ignore' },
                container: 'mp4'
            };

            const globalOutputDir = await store.get<string>('default_output_dir');

            for (const file of files) {
                if (file.status === 'idle') {
                    updateStatus(file.id, 'converting');

                    // Determine Output Directory
                    let outputDir = file.conversionSettings?.outputDir || globalOutputDir;

                    // Construct output path
                    // If outputDir is set, use it. Otherwise use input file's directory.
                    let outputPath = '';

                    // Determine filename
                    let finalFilename = file.conversionSettings?.outputName;
                    if (!finalFilename) {
                        const originalName = file.name.replace(/(\.[\w\d]+)$/, ''); // Remove extension
                        const ext = file.conversionSettings?.container || defaultPreset.container || 'mp4';
                        finalFilename = `${originalName}_optimized.${ext}`;
                    }
                    // Ensure extension
                    // ... (existing logic)

                    if (outputDir) {
                        // Ensure no double slashes, simple join
                        const separator = outputDir.endsWith('/') ? '' : '/';
                        outputPath = `${outputDir}${separator}${finalFilename}`;
                    } else {
                        // Same directory as input
                        const lastSlash = file.path.lastIndexOf('/');
                        const dir = lastSlash !== -1 ? file.path.substring(0, lastSlash + 1) : './';
                        outputPath = `${dir}${finalFilename}`;
                    }

                    invoke('convert_video_command', {
                        options: {
                            id: file.id, // Pass ID
                            input_path: file.path,
                            output_path: outputPath,
                            video_codec: file.conversionSettings?.videoCodec || defaultPreset.video.codec,
                            audio_track_index: null, // Default
                            subtitle_track_index: null, // Default
                            duration_seconds: file.duration,
                            audio_strategy: file.conversionSettings?.audioStrategy || defaultPreset.audio.strategy || 'first_track',
                            subtitle_strategy: file.conversionSettings?.subtitleStrategy || defaultPreset.subtitle?.strategy || 'ignore',
                            audio_codec: file.conversionSettings?.audioCodec || defaultPreset.audio.codec || 'aac',
                            audio_bitrate: file.conversionSettings?.audioBitrate || defaultPreset.audio.bitrate || '128k',
                            crf: file.conversionSettings?.crf || defaultPreset.video.crf,
                            preset: file.conversionSettings?.preset || defaultPreset.video.preset,
                            profile: file.conversionSettings?.profile,
                            tune: file.conversionSettings?.tune
                        }
                    }).then(() => {
                        updateStatus(file.id, 'completed');
                    }).catch((e) => {
                        console.error('Conversion failed', e);
                        // If cancelled manually, it might throw an error or just exit.
                        // We might want to handle 'cancelled' status if we add it.
                        updateStatus(file.id, 'error');
                    });
                }
            }
        } catch (e) {
            console.error('Failed to start conversion', e);
        }
    };

    const stopConversion = async (id: string) => {
        try {
            await invoke('cancel_conversion_command', { id });
            updateStatus(id, 'idle'); // Reset to idle or 'cancelled'
        } catch (e) {
            console.error('Failed to stop conversion', e);
        }
    };

    return (
        <div className="mt-8 space-y-4">
            <div className="flex justify-end">
                {files.some(f => f.status === 'idle') && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={startConversion}
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
                    >
                        <Play className="w-5 h-5 fill-current" />
                        Start Conversion
                    </motion.button>
                )}
            </div>

            <AnimatePresence mode="popLayout">
                {files.map((file) => (
                    <motion.div
                        key={file.id}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                        className={`group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md ${file.status === 'converting' ? 'border-primary/50 ring-1 ring-primary/20' : ''
                            }`}
                    >
                        <div className="p-4">
                            <div className="flex items-center gap-4">
                                <div className="relative w-12 h-16 bg-muted rounded overflow-hidden flex-shrink-0 group">
                                    {file.posterPath ? (
                                        <img src={`https://image.tmdb.org/t/p/w200${file.posterPath}`} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <FileVideo className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSearchDialogState({
                                                isOpen: true,
                                                fileId: file.id,
                                                query: file.name.replace(/(\.[\w\d]+)$/, '').replace(/[._]/g, ' ')
                                            });
                                        }}
                                    >
                                        <Search className="w-4 h-4 text-white" />
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="space-y-0.5 flex-1 min-w-0 mr-4">
                                            <h3 className="font-medium truncate" title={file.name}>
                                                {file.name}
                                            </h3>
                                            <p className="text-xs text-muted-foreground font-mono truncate">
                                                {file.path}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {file.status === 'converting' && (
                                                <button
                                                    onClick={() => stopConversion(file.id)}
                                                    className="p-2 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                    title="Stop Conversion"
                                                >
                                                    <Square className="h-4 w-4 fill-current" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setExpandedFileId(expandedFileId === file.id ? null : file.id)}
                                                className={`p-2 rounded-full hover:bg-secondary transition-colors ${expandedFileId === file.id ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
                                                title="Settings"
                                            >
                                                <SettingsIcon className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => removeFile(file.id)}
                                                className="p-2 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                title="Remove file"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span>{file.size}</span>
                                        {file.duration > 0 && (
                                            <span>
                                                {new Date(file.duration * 1000).toISOString().substr(11, 8)}
                                            </span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${file.status === 'completed' ? 'bg-green-500/10 text-green-600' :
                                            file.status === 'converting' ? 'bg-blue-500/10 text-blue-600' :
                                                file.status === 'error' ? 'bg-red-500/10 text-red-600' :
                                                    'bg-secondary text-secondary-foreground'
                                            }`}>
                                            {file.status}
                                        </span>
                                        {file.conversionSettings && (
                                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                Custom
                                            </span>
                                        )}
                                        {file.status === 'converting' && conversionDetails[file.id] && (
                                            <span className="text-[10px] text-primary animate-pulse">
                                                {conversionDetails[file.id].speed}x | {conversionDetails[file.id].fps} fps
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <AnimatePresence>
                                {expandedFileId === file.id && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="pt-4 mt-4 border-t grid grid-cols-2 gap-4 text-sm">
                                            <div className="col-span-2 space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Apply Preset</label>
                                                <select
                                                    onChange={async (e) => {
                                                        const presetId = e.target.value;
                                                        if (!presetId) return;

                                                        // Load presets to find the selected one
                                                        // Note: In a real app we might want to pass presets as prop or use a hook
                                                        const store = await Store.load('settings.json');
                                                        const presets = await store.get<any[]>('presets') || [];
                                                        const preset = presets.find((p: any) => p.id === presetId);

                                                        if (preset) {
                                                            updateFileSettings(file.id, {
                                                                videoCodec: preset.video.codec,
                                                                crf: preset.video.crf,
                                                                preset: preset.video.preset,
                                                                audioCodec: preset.audio.codec,
                                                                audioBitrate: preset.audio.bitrate,
                                                                audioStrategy: preset.audio.strategy,
                                                                subtitleStrategy: preset.subtitle?.strategy,
                                                                container: preset.container
                                                            });

                                                            // Also update filename extension
                                                            const currentName = file.conversionSettings?.outputName || file.name;
                                                            const newName = currentName.replace(/\.[\w\d]+$/, `.${preset.container}`);
                                                            updateFileSettings(file.id, { outputName: newName });
                                                        }
                                                        // Reset select to empty
                                                        e.target.value = "";
                                                    }}
                                                    className="w-full px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                                >
                                                    <option value="">Select a preset to apply...</option>
                                                    {availablePresets.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Video Codec</label>
                                                <select
                                                    value={file.conversionSettings?.videoCodec || 'default'}
                                                    onChange={(e) => updateFileSettings(file.id, { videoCodec: e.target.value === 'default' ? undefined : e.target.value })}
                                                    className="w-full px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                                >
                                                    <option value="default">Default (Global)</option>
                                                    <option value="libx264">H.264 (CPU)</option>
                                                    <option value="h264_nvenc">H.264 (NVENC)</option>
                                                    <option value="libx265">H.265 (CPU)</option>
                                                    <option value="hevc_nvenc">H.265 (NVENC)</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Container</label>
                                                <select
                                                    value={file.conversionSettings?.container || availablePresets.find(p => p.id === defaultPresetId)?.container || 'mp4'}
                                                    onChange={(e) => {
                                                        const newContainer = e.target.value;
                                                        const currentName = file.conversionSettings?.outputName || file.name;
                                                        // Replace extension
                                                        const newName = currentName.replace(/\.[\w\d]+$/, `.${newContainer}`);
                                                        updateFileSettings(file.id, {
                                                            container: newContainer,
                                                            outputName: newName
                                                        });
                                                    }}
                                                    className="w-full px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                                >
                                                    <option value="mp4">MP4</option>
                                                    <option value="mkv">MKV</option>
                                                    <option value="avi">AVI</option>
                                                    <option value="mov">MOV</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Audio Strategy</label>
                                                <select
                                                    value={file.conversionSettings?.audioStrategy || 'default'}
                                                    onChange={(e) => updateFileSettings(file.id, { audioStrategy: e.target.value === 'default' ? undefined : e.target.value })}
                                                    className="w-full px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                                >
                                                    <option value="default">Default</option>
                                                    <option value="copy_all">Copy All Tracks</option>
                                                    <option value="convert_all">Convert All (AAC)</option>
                                                    <option value="first_track">First Track Only</option>
                                                </select>
                                            </div>

                                            {/* Audio Details (Codec & Bitrate) - Show if not Copy All */}
                                            {file.conversionSettings?.audioStrategy !== 'copy_all' && (
                                                <>
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-medium text-muted-foreground">Audio Codec</label>
                                                        <select
                                                            value={file.conversionSettings?.audioCodec || 'aac'}
                                                            onChange={(e) => updateFileSettings(file.id, { audioCodec: e.target.value })}
                                                            className="w-full px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                                        >
                                                            <option value="aac">AAC</option>
                                                            <option value="ac3">AC3</option>
                                                            <option value="copy">Copy</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-medium text-muted-foreground">Audio Bitrate</label>
                                                        <select
                                                            value={file.conversionSettings?.audioBitrate || '128k'}
                                                            onChange={(e) => updateFileSettings(file.id, { audioBitrate: e.target.value })}
                                                            className="w-full px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                                            disabled={file.conversionSettings?.audioCodec === 'copy'}
                                                        >
                                                            <option value="64k">64k</option>
                                                            <option value="128k">128k</option>
                                                            <option value="192k">192k</option>
                                                            <option value="320k">320k</option>
                                                        </select>
                                                    </div>
                                                </>
                                            )}
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Subtitle Strategy</label>
                                                <select
                                                    value={file.conversionSettings?.subtitleStrategy || 'default'}
                                                    onChange={(e) => updateFileSettings(file.id, { subtitleStrategy: e.target.value === 'default' ? undefined : e.target.value })}
                                                    className="w-full px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                                >
                                                    <option value="default">Default</option>
                                                    <option value="ignore">Ignore</option>
                                                    <option value="copy_all">Copy All</option>
                                                </select>
                                            </div>

                                            {/* Advanced Settings Row */}
                                            <div className="col-span-2 grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
                                                <div className="space-y-1">
                                                    <div className="flex justify-between">
                                                        <label className="text-xs font-medium text-muted-foreground">Quality (CRF)</label>
                                                        <span className="text-xs text-primary font-mono">{file.conversionSettings?.crf || 23}</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="18"
                                                        max="28"
                                                        step="1"
                                                        value={file.conversionSettings?.crf || 23}
                                                        onChange={(e) => updateFileSettings(file.id, { crf: parseInt(e.target.value) })}
                                                        className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                                        title="Lower is better quality, Higher is smaller size"
                                                    />
                                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                                        <span>High Quality</span>
                                                        <span>Small Size</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-muted-foreground">Preset (Speed)</label>
                                                    <select
                                                        value={file.conversionSettings?.preset || 'fast'}
                                                        onChange={(e) => updateFileSettings(file.id, { preset: e.target.value })}
                                                        className="w-full px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                                    >
                                                        <option value="ultrafast">Ultrafast (Low Comp)</option>
                                                        <option value="superfast">Superfast</option>
                                                        <option value="veryfast">Veryfast</option>
                                                        <option value="faster">Faster</option>
                                                        <option value="fast">Fast (Default)</option>
                                                        <option value="medium">Medium</option>
                                                        <option value="slow">Slow (Better Comp)</option>
                                                        <option value="slower">Slower</option>
                                                        <option value="veryslow">Veryslow</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="col-span-2 space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Output Filename</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={file.conversionSettings?.outputName || ''}
                                                        onChange={(e) => updateFileSettings(file.id, { outputName: e.target.value })}
                                                        placeholder={`${file.name.replace(/(\.[\w\d]+)$/, '')}_optimized.${file.conversionSettings?.container || availablePresets.find(p => p.id === defaultPresetId)?.container || 'mp4'}`}
                                                        className="flex-1 px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const cleanName = await invoke<string>('clean_filename_command', { filename: file.name });
                                                                // cleanName comes with .mp4 by default from backend. 
                                                                // We need to ensure it matches the current container.
                                                                const currentContainer = file.conversionSettings?.container || availablePresets.find(p => p.id === defaultPresetId)?.container || 'mp4';
                                                                const finalName = cleanName.replace(/\.mp4$/, `.${currentContainer}`);

                                                                updateFileSettings(file.id, { outputName: finalName });
                                                            } catch (e) {
                                                                console.error("Failed to clean filename", e);
                                                            }
                                                        }}
                                                        className="p-1.5 rounded-md border hover:bg-primary/10 hover:text-primary transition-colors"
                                                        title="Auto-Rename (Smart Clean)"
                                                    >
                                                        <Wand2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="col-span-2 space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Output Directory</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={file.conversionSettings?.outputDir || ''}
                                                        readOnly
                                                        placeholder="Global Default (or Input Dir)"
                                                        className="flex-1 px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            const selected = await open({
                                                                directory: true,
                                                                multiple: false,
                                                                defaultPath: file.conversionSettings?.outputDir || undefined
                                                            });
                                                            if (selected && typeof selected === 'string') {
                                                                updateFileSettings(file.id, { outputDir: selected });
                                                            }
                                                        }}
                                                        className="p-1.5 rounded-md border hover:bg-muted transition-colors"
                                                        title="Select Folder"
                                                    >
                                                        <FolderOpen className="w-4 h-4" />
                                                    </button>
                                                    {file.conversionSettings?.outputDir && (
                                                        <button
                                                            onClick={() => updateFileSettings(file.id, { outputDir: undefined })}
                                                            className="p-1.5 rounded-md border hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                            title="Clear (Use Default)"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div >
                    </motion.div >
                ))}
            </AnimatePresence >

            <MetadataSearchDialog
                isOpen={searchDialogState.isOpen}
                onClose={() => setSearchDialogState(prev => ({ ...prev, isOpen: false }))}
                initialQuery={searchDialogState.query}
                onSelect={(movie) => {
                    if (searchDialogState.fileId) {
                        const fileId = searchDialogState.fileId;
                        const file = files.find(f => f.id === fileId);

                        const year = movie.release_date?.split('-')[0] || '';
                        const cleanTitle = movie.title.replace(/[:/\\?*|"><]/g, ''); // Remove illegal chars

                        // Determine container
                        const currentContainer = file?.conversionSettings?.container || availablePresets.find(p => p.id === defaultPresetId)?.container || 'mp4';
                        const newName = `${cleanTitle} (${year}).${currentContainer}`;

                        updateFileSettings(fileId, { outputName: newName });

                        updateMetadata(fileId, {
                            tmdbId: movie.id,
                            posterPath: movie.poster_path,
                            overview: movie.overview,
                            releaseDate: movie.release_date
                        });
                    }
                    setSearchDialogState(prev => ({ ...prev, isOpen: false }));
                }}
            />

            {
                files.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center text-muted-foreground py-8"
                    >
                        No videos added yet
                    </motion.div>
                )
            }
        </div >
    );
};
