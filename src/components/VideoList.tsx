import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileVideo, Trash2, Play, Settings as SettingsIcon, FolderOpen, Wand2, Search, Square, X } from 'lucide-react';
import { useVideoStore } from '../store/videoStore';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { documentDir } from '@tauri-apps/api/path';
import { Store } from '@tauri-apps/plugin-store';
import { MetadataSearchDialog } from './MetadataSearchDialog';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { extractMovieTitleAndYear } from '../utils/metadataUtils';

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
    defaultPresetId,
    updateStatus,
    startNextConversion
}: {
    file: any,
    expandedFileId: string | null,
    toggleExpand: (id: string) => void,
    updateFileSettings: (id: string, settings: any) => void,
    removeFile: (id: string) => void,
    conversionDetails: any,
    openSearchDialog: (id: string) => void,
    availablePresets: any[],
    defaultPresetId: string,
    updateStatus: (id: string, status: 'idle' | 'queued' | 'converting' | 'completed' | 'error') => void,
    startNextConversion: () => void
}) => {
    const isExpanded = expandedFileId === file.id;
    const details = conversionDetails[file.id];

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
            {(file.status === 'converting' || file.status === 'completed' || file.status === 'queued') && (
                <div
                    className={`absolute inset-0 opacity-5 transition-all duration-1000 ${file.status === 'completed' ? 'bg-green-500/20' :
                        file.status === 'queued' ? 'bg-yellow-500/20' :
                            'bg-primary/10'
                        }`}
                    style={{
                        width: file.status === 'completed' ? '100%' :
                            file.status === 'queued' ? '100%' :
                                `${file.progress}%`,
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
                                    file.status === 'queued' ? 'text-yellow-500' :
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
                            {file.status === 'queued' && (
                                <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-[10px] font-medium border border-yellow-500/20">
                                    En attente
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {file.size && file.size !== "Unknown" && (
                                <span className="flex items-center gap-1 bg-secondary/50 px-1.5 py-0.5 rounded-md">
                                    <FolderOpen className="w-3 h-3" />
                                    {file.size}
                                </span>
                            )}
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
                                        {details.speed.includes('x') ? details.speed : `${details.speed}x`}
                                    </span>
                                </>
                            )}
                        </div>
                        {/* Progress Bar */}
                        {file.status === 'converting' && (
                            <div className="mt-2 space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Progression</span>
                                    <span className="font-medium text-primary">{Math.round(file.progress)}%</span>
                                </div>
                                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                                        style={{ width: `${file.progress}%` }}
                                    />
                                </div>
                                {details && (
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                        {details.elapsed_time && (
                                            <span>Écoulé: {details.elapsed_time}</span>
                                        )}
                                        {details.time && (
                                            <span>• Position: {details.time}</span>
                                        )}
                                        {details.time_remaining && (
                                            <span className="text-primary font-medium">• Restant: {details.time_remaining}</span>
                                        )}
                                        {details.speed && (
                                            <span>• Vitesse: {details.speed.includes('x') ? details.speed : `${details.speed}x`}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        {file.status === 'converting' && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                    try {
                                        await invoke('cancel_conversion_command', { id: file.id });
                                        updateStatus(file.id, 'idle');
                                        // Start next conversion in queue
                                        startNextConversion();
                                    } catch (e) {
                                        console.error('Failed to cancel conversion', e);
                                    }
                                }}
                                className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-full"
                                title="Arrêter la conversion"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openSearchDialog(file.id)}
                            className="hover:bg-primary/10 hover:text-primary rounded-full transition-colors"
                            title="Search Metadata"
                        >
                            <Search className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleExpand(file.id)}
                            className={`rounded-full transition-all duration-300 ${isExpanded ? 'bg-primary/10 text-primary rotate-180' : 'hover:bg-secondary text-muted-foreground'}`}
                        >
                            <SettingsIcon className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(file.id)}
                            className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-full"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
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
                                    <Select
                                        value=""
                                        onChange={async (val) => {
                                            const presetId = val;
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
                                        }}
                                        placeholder="Select a preset to apply..."
                                        options={availablePresets.map(p => ({ value: p.id, label: p.name }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Video Codec</label>
                                    <Select
                                        value={file.conversionSettings?.videoCodec || 'default'}
                                        onChange={(val) => updateFileSettings(file.id, { videoCodec: val })}
                                        options={[
                                            { value: 'default', label: 'Default (Global)' },
                                            { value: 'libx264', label: 'H.264 (CPU)' },
                                            { value: 'libx265', label: 'H.265 (CPU)' },
                                            { value: 'h264_nvenc', label: 'H.264 (NVIDIA)' },
                                            { value: 'hevc_nvenc', label: 'H.265 (NVIDIA)' },
                                            { value: 'h264_qsv', label: 'H.264 (Intel QSV)' },
                                            { value: 'hevc_qsv', label: 'H.265 (Intel QSV)' },
                                            { value: 'h264_vaapi', label: 'H.264 (VAAPI)' },
                                            { value: 'hevc_vaapi', label: 'H.265 (VAAPI)' },
                                            { value: 'h264_videotoolbox', label: 'H.264 (Apple)' },
                                            { value: 'hevc_videotoolbox', label: 'H.265 (Apple)' }
                                        ]}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Container</label>
                                    <Select
                                        value={file.conversionSettings?.container || availablePresets.find(p => p.id === defaultPresetId)?.container || 'mp4'}
                                        onChange={(val) => {
                                            const newContainer = val;
                                            const currentName = file.conversionSettings?.outputName || file.name;
                                            // Replace extension
                                            const newName = currentName.replace(/\.[\w\d]+$/, `.${newContainer}`);
                                            updateFileSettings(file.id, {
                                                container: newContainer,
                                                outputName: newName
                                            });
                                        }}
                                        options={[
                                            { value: 'mp4', label: 'MP4' },
                                            { value: 'mkv', label: 'MKV' },
                                            { value: 'avi', label: 'AVI' },
                                            { value: 'mov', label: 'MOV' }
                                        ]}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Audio Strategy</label>
                                    <Select
                                        value={file.conversionSettings?.audioStrategy || 'first_track'}
                                        onChange={(val) => updateFileSettings(file.id, { audioStrategy: val })}
                                        options={[
                                            { value: 'first_track', label: 'First Track' },
                                            { value: 'copy_all', label: 'Copy All Tracks' },
                                            { value: 'convert_all', label: 'Convert All (AAC)' }
                                        ]}
                                    />
                                </div>

                                {/* Audio Codec & Bitrate - Only show if not Copy All */}
                                {file.conversionSettings?.audioStrategy !== 'copy_all' && (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Audio Codec</label>
                                            <Select
                                                value={file.conversionSettings?.audioCodec || 'aac'}
                                                onChange={(val) => updateFileSettings(file.id, { audioCodec: val })}
                                                options={[
                                                    { value: 'aac', label: 'AAC' },
                                                    { value: 'ac3', label: 'AC3' },
                                                    { value: 'copy', label: 'Copy' }
                                                ]}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Audio Bitrate</label>
                                            <Select
                                                value={file.conversionSettings?.audioBitrate || '128k'}
                                                onChange={(val) => updateFileSettings(file.id, { audioBitrate: val })}
                                                options={[
                                                    { value: '64k', label: '64k' },
                                                    { value: '128k', label: '128k' },
                                                    { value: '192k', label: '192k' },
                                                    { value: '320k', label: '320k' }
                                                ]}
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Subtitle Strategy</label>
                                    <Select
                                        value={file.conversionSettings?.subtitleStrategy || 'ignore'}
                                        onChange={(val) => updateFileSettings(file.id, { subtitleStrategy: val })}
                                        options={[
                                            { value: 'ignore', label: 'Ignore' },
                                            { value: 'copy_all', label: 'Copy All' },
                                            { value: 'burn_in', label: 'Burn In (First Track)' }
                                        ]}
                                    />
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
                                        <Select
                                            value={file.conversionSettings?.preset || 'medium'}
                                            onChange={(val) => updateFileSettings(file.id, { preset: val })}
                                            options={[
                                                { value: 'ultrafast', label: 'Ultrafast' },
                                                { value: 'superfast', label: 'Superfast' },
                                                { value: 'veryfast', label: 'Veryfast' },
                                                { value: 'faster', label: 'Faster' },
                                                { value: 'fast', label: 'Fast (Default)' },
                                                { value: 'medium', label: 'Medium' },
                                                { value: 'slow', label: 'Slow' },
                                                { value: 'slower', label: 'Slower' },
                                                { value: 'veryslow', label: 'Veryslow' }
                                            ]}
                                        />
                                    </div>
                                </div>

                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Output Filename</label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            value={file.conversionSettings?.outputName || ''}
                                            onChange={(e) => updateFileSettings(file.id, { outputName: e.target.value })}
                                            placeholder={`${file.name.replace(/(\.[\w\d]+)$/, '')}_optimized.${file.conversionSettings?.container || availablePresets.find(p => p.id === defaultPresetId)?.container || 'mp4'}`}
                                            className="flex-1 text-xs"
                                        />
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={async () => {
                                                try {
                                                    if (!file.metadata) {
                                                        console.error("No metadata available for file");
                                                        return;
                                                    }

                                                    // Get current container
                                                    const currentContainer = file.conversionSettings?.container || availablePresets.find(p => p.id === defaultPresetId)?.container || 'mp4';

                                                    // Get output video codec (from settings or default preset)
                                                    let outputVideoCodec = file.conversionSettings?.videoCodec;
                                                    if (!outputVideoCodec || outputVideoCodec === 'default') {
                                                        const defaultPreset = availablePresets.find(p => p.id === defaultPresetId);
                                                        outputVideoCodec = defaultPreset?.video?.codec;
                                                    }

                                                    // Generate smart filename with metadata
                                                    const smartName = await invoke<string>('generate_smart_filename_command', {
                                                        filename: file.name,
                                                        metadata: file.metadata,
                                                        outputVideoCodec: outputVideoCodec || null,
                                                        container: currentContainer
                                                    });

                                                    updateFileSettings(file.id, { outputName: smartName });
                                                } catch (e) {
                                                    console.error("Failed to generate smart filename", e);
                                                }
                                            }}
                                            className="hover:bg-primary/10 hover:text-primary"
                                            title="Auto-Rename (Smart with Metadata)"
                                        >
                                            <Wand2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Output Directory</label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            readOnly
                                            value={file.conversionSettings?.outputDir || ''}
                                            placeholder="Default (Same as input or Global Setting)"
                                            className="flex-1 text-xs text-muted-foreground"
                                        />
                                        <Button
                                            variant="outline"
                                            size="icon"
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
                                            className="hover:bg-primary/10 hover:text-primary"
                                            title="Select Output Folder"
                                        >
                                            <FolderOpen className="w-3 h-3" />
                                        </Button>
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
    const [conversionDetails, setConversionDetails] = React.useState<Record<string, { fps: number, time: string, elapsed_time: string, speed: string, time_remaining?: string }>>({});

    // Metadata Search State
    const [searchDialogState, setSearchDialogState] = React.useState<{ isOpen: boolean, fileId: string | null, query: string, year?: string }>({
        isOpen: false,
        fileId: null,
        query: '',
        year: undefined
    });

    const [availablePresets, setAvailablePresets] = React.useState<any[]>([]);
    const [defaultPresetId, setDefaultPresetId] = React.useState<string>('default-high');

    const loadPresets = React.useCallback(async () => {
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
    }, []);

    React.useEffect(() => {
        loadPresets();

        // Listen for preset updates from SettingsDialog
        const handlePresetsUpdated = () => {
            loadPresets();
        };
        window.addEventListener('presets-updated', handlePresetsUpdated);

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
                        elapsed_time: payload.elapsed_time,
                        speed: payload.speed,
                        time_remaining: payload.time_remaining
                    }
                }));
            }
        });

        return () => {
            window.removeEventListener('presets-updated', handlePresetsUpdated);
            unlisten.then(f => f());
        };
    }, [loadPresets, updateProgress]);

    const toggleExpand = (id: string) => {
        setExpandedFileId(prev => prev === id ? null : id);
    };


    const openSearchDialog = (id: string) => {
        const file = files.find(f => f.id === id);
        if (file) {
            // Extract movie title and year intelligently
            const { title, year } = extractMovieTitleAndYear(file.name);
            setSearchDialogState({
                isOpen: true,
                fileId: id,
                query: title,
                year: year || undefined
            });
        }
    };

    // Function to start the next conversion in the queue
    const startNextConversion = async () => {
        // Check if there's already a conversion running
        const isConverting = files.some(f => f.status === 'converting');
        if (isConverting) {
            return; // Already converting, don't start another
        }

        // Find the first file in queue
        const nextFile = files.find(f => f.status === 'queued');
        if (!nextFile) {
            return; // No files in queue
        }

        try {
            const store = await Store.load('settings.json');
            const defaultPresetId = await store.get<string>('default_preset_id') || 'default-high';
            const presets = await store.get<any[]>('presets') || [];

            const defaultPreset = presets.find((p: any) => p.id === defaultPresetId) || presets[0] || {
                video: { codec: 'libx264', preset: 'medium', crf: 23 },
                audio: { codec: 'aac', bitrate: '128k', strategy: 'first_track' },
                subtitle: { strategy: 'ignore' },
                container: 'mp4'
            };

            const globalOutputDir = await store.get<string>('default_output_dir');

            // Mark as converting
            updateStatus(nextFile.id, 'converting');

            // Determine Output Directory
            let outputDir = nextFile.conversionSettings?.outputDir || globalOutputDir;

            // Construct output path
            // If outputDir is set, use it. Otherwise use input file's directory.
            let outputPath = '';

            // Determine filename
            let finalFilename = nextFile.conversionSettings?.outputName;
            if (!finalFilename) {
                const originalName = nextFile.name.replace(/(\.[\w\d]+)$/, ''); // Remove extension
                const ext = nextFile.conversionSettings?.container || defaultPreset.container || 'mp4';
                finalFilename = `${originalName}_optimized.${ext}`;
            }
            // Ensure extension
            // ... (existing logic)

            if (outputDir) {
                // Normalize path separators for Windows
                const normalizedDir = outputDir.replace(/\\/g, '/');
                const separator = normalizedDir.endsWith('/') ? '' : '/';
                outputPath = `${normalizedDir}${separator}${finalFilename}`;
            } else {
                // Same directory as input
                const normalizedPath = nextFile.path.replace(/\\/g, '/');
                const lastSlash = normalizedPath.lastIndexOf('/');
                const dir = lastSlash !== -1 ? normalizedPath.substring(0, lastSlash + 1) : './';
                outputPath = `${dir}${finalFilename}`;
            }

            // Ensure crf is a valid number (0-51)
            const crfValue = nextFile.conversionSettings?.crf ?? defaultPreset.video.crf ?? 23;
            const crf = typeof crfValue === 'number' && crfValue >= 0 && crfValue <= 51
                ? Math.round(crfValue) as number
                : 23;

            console.log(`Starting conversion for ${nextFile.name}:`, {
                input: nextFile.path,
                output: outputPath,
                videoCodec: nextFile.conversionSettings?.videoCodec || defaultPreset.video.codec,
                crf,
                duration: nextFile.duration
            });

            invoke('convert_video_command', {
                options: {
                    id: nextFile.id, // Pass ID
                    input_path: nextFile.path,
                    output_path: outputPath,
                    video_codec: nextFile.conversionSettings?.videoCodec || defaultPreset.video.codec,
                    audio_track_index: null, // Default
                    subtitle_track_index: null, // Default
                    duration_seconds: nextFile.duration,
                    total_frames: nextFile.totalFrames || null,
                    audio_strategy: nextFile.conversionSettings?.audioStrategy || defaultPreset.audio.strategy || 'first_track',
                    subtitle_strategy: nextFile.conversionSettings?.subtitleStrategy || defaultPreset.subtitle?.strategy || 'ignore',
                    audio_codec: nextFile.conversionSettings?.audioCodec || defaultPreset.audio.codec || 'aac',
                    audio_bitrate: nextFile.conversionSettings?.audioBitrate || defaultPreset.audio.bitrate || '128k',
                    crf: crf,
                    preset: nextFile.conversionSettings?.preset || defaultPreset.video.preset,
                    profile: nextFile.conversionSettings?.profile,
                    tune: nextFile.conversionSettings?.tune
                }
            }).then(() => {
                console.log(`Conversion completed for ${nextFile.name}`);
                updateStatus(nextFile.id, 'completed');
                // Start next conversion in queue
                startNextConversion();
            }).catch((e) => {
                console.error(`Conversion failed for ${nextFile.name}:`, e);
                // If cancelled manually, it might throw an error or just exit.
                updateStatus(nextFile.id, 'error');
                // Start next conversion in queue even if this one failed
                startNextConversion();
            });
        } catch (e) {
            console.error('Failed to start conversion', e);
            // If we failed to start, mark as error and try next
            updateStatus(nextFile.id, 'error');
            startNextConversion();
        }
    };

    // Function to queue all idle files for conversion
    const startConversion = async () => {
        // Put all idle files in queue
        for (const file of files) {
            if (file.status === 'idle') {
                updateStatus(file.id, 'queued');
            }
        }

        // Start the first conversion
        startNextConversion();
    };



    return (
        <div className="mt-8 space-y-4">
            <div className="flex justify-end">
                {files.some(f => f.status === 'idle' || f.status === 'queued') && (
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
                        updateStatus={updateStatus}
                        startNextConversion={startNextConversion}
                    />
                ))}
            </AnimatePresence>

            <MetadataSearchDialog
                isOpen={searchDialogState.isOpen}
                onClose={() => setSearchDialogState(prev => ({ ...prev, isOpen: false }))}
                initialQuery={searchDialogState.query}
                initialYear={searchDialogState.year}
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
