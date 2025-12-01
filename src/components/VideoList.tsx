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
