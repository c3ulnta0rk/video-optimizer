import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileVideo, Trash2, Play, Settings as SettingsIcon } from 'lucide-react';
import { ProgressChart } from './ProgressChart';
import { useVideoStore } from '../store/videoStore';
import { invoke } from '@tauri-apps/api/core';
import { Store } from '@tauri-apps/plugin-store';

export const VideoList: React.FC = () => {
    const { files, removeFile, updateStatus, updateFileSettings } = useVideoStore();
    const [expandedFileId, setExpandedFileId] = React.useState<string | null>(null);

    const startConversion = async () => {
        try {
            const store = await Store.load('settings.json');
            const encoder = await store.get<string>('default_encoder') || 'libx264';

            for (const file of files) {
                if (file.status === 'idle') {
                    updateStatus(file.id, 'converting');

                    // Construct output path (simple append for now)
                    // TODO: Use Smart Renamer or user defined path
                    const outputPath = file.path.replace(/(\.[\w\d]+)$/, '_optimized.mp4');

                    invoke('convert_video_command', {
                        options: {
                            input_path: file.path,
                            output_path: outputPath,
                            video_codec: file.conversionSettings?.videoCodec || encoder,
                            audio_track_index: null, // Default
                            subtitle_track_index: null, // Default
                            duration_seconds: file.duration,
                            audio_strategy: file.conversionSettings?.audioStrategy || 'first_track',
                            subtitle_strategy: file.conversionSettings?.subtitleStrategy || 'ignore',
                            audio_codec: file.conversionSettings?.audioCodec || 'aac',
                            audio_bitrate: file.conversionSettings?.audioBitrate || '128k'
                        }
                    }).then(() => {
                        updateStatus(file.id, 'completed');
                    }).catch((e) => {
                        console.error('Conversion failed', e);
                        updateStatus(file.id, 'error');
                    });
                }
            }
        } catch (e) {
            console.error('Failed to start conversion', e);
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
                                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <FileVideo className="h-6 w-6" />
                                    {file.progress > 0 && file.progress < 100 && (
                                        <div className="absolute inset-0">
                                            <ProgressChart progress={file.progress} size={48} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="font-medium truncate pr-4" title={file.name}>
                                            {file.name}
                                        </h4>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

            {files.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-muted-foreground py-8"
                >
                    No videos added yet
                </motion.div>
            )}
        </div>
    );
};
