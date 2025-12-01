import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileVideo, Trash2, Play, Settings as SettingsIcon, FolderOpen, Wand2, Search, Square } from 'lucide-react';
import { useVideoStore } from '../store/videoStore';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { documentDir } from '@tauri-apps/api/path';
import { Store } from '@tauri-apps/plugin-store';
import { MetadataSearchDialog } from './MetadataSearchDialog';

// Extract FileItem to a memoized component to prevent re-renders of all items when one changes
const FileItem = React.memo(({
    file,
    expandedFileId,
    toggleExpand,
    updateFileSettings,
    removeFile,
    conversionDetails,
    openSearchDialog,
    availablePresets,
    defaultPresetId
}: {
    file: any,
    expandedFileId: string | null,
    toggleExpand: (id: string) => void,
    updateFileSettings: (id: string, settings: any) => void,
    removeFile: (id: string) => void,
    conversionDetails: any,
    openSearchDialog: (id: string) => void,
    availablePresets: any[],
    defaultPresetId: string
}) => {
    const isExpanded = expandedFileId === file.id;
    const details = conversionDetails[file.id];

    // Helper to format size
    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Helper to format duration
    const formatDuration = (seconds: number) => {
        return new Date(seconds * 1000).toISOString().substr(11, 8);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${isExpanded
                ? 'bg-card shadow-lg ring-1 ring-primary/20'
                : 'bg-card/50 hover:bg-card hover:shadow-md'
                }`}
        >
            {/* Progress Background */}
            {(file.status === 'converting' || file.status === 'completed') && (
                <div
                    className={`absolute inset-0 opacity-5 transition-all duration-1000 ${file.status === 'completed' ? 'bg-green-500/20' : 'bg-primary/10'
                        }`}
                    style={{
                        width: file.status === 'completed' ? '100%' : `${file.progress}%`,
                    }}
                />
            )}

            <div className="p-4">
                <div className="flex items-center gap-4">
                    {/* Poster / Icon */}
                    <div className="relative shrink-0 overflow-hidden rounded-lg w-12 h-16 bg-muted flex items-center justify-center border shadow-sm group-hover:scale-105 transition-transform duration-300">
                        {file.posterPath ? (
                            <img
                                src={`https://image.tmdb.org/t/p/w92${file.posterPath}`}
                                alt="Poster"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <FileVideo className={`w-6 h-6 ${file.status === 'completed' ? 'text-green-500' :
                                file.status === 'error' ? 'text-destructive' :
                                    'text-primary/70'
                                }`} />
                        )}
                        {file.status === 'completed' && (
                            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-[1px]">
                                <Square className="w-6 h-6 text-green-500 drop-shadow-sm" />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate text-base tracking-tight" title={file.name}>
                                {file.name}
                            </h3>
                            {file.tmdbId && (
                                <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-[10px] font-bold border border-yellow-500/20">
                                    TMDB
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 bg-secondary/50 px-1.5 py-0.5 rounded-md">
                                <FolderOpen className="w-3 h-3" />
                                {formatSize(file.size)}
                            </span>
                            {file.duration > 0 && (
                                <span className="flex items-center gap-1 bg-secondary/50 px-1.5 py-0.5 rounded-md">
                                    <Play className="w-3 h-3" />
                                    {formatDuration(file.duration)}
                                </span>
                            )}
                            {file.status === 'converting' && details && (
                                <>
                                    <span className="text-primary font-medium animate-pulse">
                                        {details.fps.toFixed(1)} fps
                                    </span>
                                    <span className="text-primary font-medium">
                                        {details.speed}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => openSearchDialog(file.id)}
                            className="p-2 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                            title="Search Metadata"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => toggleExpand(file.id)}
                            className={`p-2 rounded-full transition-all duration-300 ${isExpanded ? 'bg-primary/10 text-primary rotate-180' : 'hover:bg-secondary text-muted-foreground'
                                }`}
                        >
                            <SettingsIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => removeFile(file.id)}
                            className="p-2 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Expanded Settings */}
                <AnimatePresence>
                    {isExpanded && (
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
                                        onChange={(e) => updateFileSettings(file.id, { videoCodec: e.target.value })}
                                        className="w-full px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                    >
                                        <option value="default">Default (Global)</option>
                                        <option value="libx264">H.264 (CPU)</option>
                                        <option value="libx265">H.265 (CPU)</option>
                                        <option value="h264_nvenc">H.264 (NVIDIA)</option>
                                        <option value="hevc_nvenc">H.265 (NVIDIA)</option>
                                        <option value="h264_qsv">H.264 (Intel QSV)</option>
                                        <option value="hevc_qsv">H.265 (Intel QSV)</option>
                                        <option value="h264_vaapi">H.264 (VAAPI)</option>
                                        <option value="hevc_vaapi">H.265 (VAAPI)</option>
                                        <option value="h264_videotoolbox">H.264 (Apple)</option>
                                        <option value="hevc_videotoolbox">H.265 (Apple)</option>
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
                                        value={file.conversionSettings?.audioStrategy || 'first_track'}
                                        onChange={(e) => updateFileSettings(file.id, { audioStrategy: e.target.value })}
                                        className="w-full px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                    >
                                        <option value="first_track">First Track</option>
                                        <option value="copy_all">Copy All Tracks</option>
                                        <option value="convert_all">Convert All (AAC)</option>
                                    </select>
                                </div>

                                {/* Audio Codec & Bitrate - Only show if not Copy All */}
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
                                        value={file.conversionSettings?.subtitleStrategy || 'ignore'}
                                        onChange={(e) => updateFileSettings(file.id, { subtitleStrategy: e.target.value })}
                                        className="w-full px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                    >
                                        <option value="ignore">Ignore</option>
                                        <option value="copy_all">Copy All</option>
                                        <option value="burn_in">Burn In (First Track)</option>
                                    </select>
                                </div>

                                {/* Advanced Video Settings */}
                                <div className="col-span-2 border-t border-dashed my-2"></div>

                                <div className="col-span-2 grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-medium text-muted-foreground">Quality (CRF)</label>
                                            <span className="text-[10px] font-mono">{file.conversionSettings?.crf || 23}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="18"
                                            max="28"
                                            step="1"
                                            value={file.conversionSettings?.crf || 23}
                                            onChange={(e) => updateFileSettings(file.id, { crf: parseInt(e.target.value) })}
                                            className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        <div className="flex justify-between text-[8px] text-muted-foreground">
                                            <span>High Quality</span>
                                            <span>Small Size</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Preset (Speed)</label>
                                        <select
                                            value={file.conversionSettings?.preset || 'medium'}
                                            onChange={(e) => updateFileSettings(file.id, { preset: e.target.value })}
                                            className="w-full px-2 py-1.5 rounded-md border bg-background/50 text-xs"
                                        >
                                            <option value="ultrafast">Ultrafast</option>
                                            <option value="superfast">Superfast</option>
                                            <option value="veryfast">Veryfast</option>
                                            <option value="faster">Faster</option>
                                            <option value="fast">Fast (Default)</option>
                                            <option value="medium">Medium</option>
                                            <option value="slow">Slow</option>
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
                                            <Wand2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Output Directory</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={file.conversionSettings?.outputDir || ''}
                                            placeholder="Default (Same as input or Global Setting)"
                                            className="flex-1 px-2 py-1.5 rounded-md border bg-background/50 text-xs text-muted-foreground"
                                        />
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const selected = await open({
                                                        directory: true,
                                                        multiple: false,
                                                        defaultPath: await documentDir(),
                                                    });
                                                    if (selected && typeof selected === 'string') {
                                                        updateFileSettings(file.id, { outputDir: selected });
                                                    }
                                                } catch (err) {
                                                    console.error("Failed to pick directory", err);
                                                }
                                            }}
                                            className="p-1.5 rounded-md border hover:bg-primary/10 hover:text-primary transition-colors"
                                            title="Select Output Folder"
                                        >
                                            <FolderOpen className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
});

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

    const toggleExpand = (id: string) => {
        setExpandedFileId(prev => prev === id ? null : id);
    };

    const openSearchDialog = (id: string) => {
        const file = files.find(f => f.id === id);
        if (file) {
            setSearchDialogState({
                isOpen: true,
                fileId: id,
                query: file.name.replace(/(\.[\w\d]+)$/, '').replace(/[._]/g, ' ')
            });
        }
    };

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
                    <FileItem
                        key={file.id}
                        file={file}
                        expandedFileId={expandedFileId}
                        toggleExpand={toggleExpand}
                        updateFileSettings={updateFileSettings}
                        removeFile={removeFile}
                        conversionDetails={conversionDetails}
                        openSearchDialog={openSearchDialog}
                        availablePresets={availablePresets}
                        defaultPresetId={defaultPresetId}
                    />
                ))}
            </AnimatePresence>

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
