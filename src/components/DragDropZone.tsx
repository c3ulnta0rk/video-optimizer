import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileVideo } from 'lucide-react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { VideoList } from './VideoList';
import { useVideoStore, FileItem } from '../store/videoStore';
import { autoSearchAndAssociateMetadata } from '../utils/metadataUtils';

export const DragDropZone: React.FC = () => {
    const [isDragging, setIsDragging] = useState(false);
    const addFiles = useVideoStore((state) => state.addFiles);
    const updateMetadata = useVideoStore((state) => state.updateMetadata);

    const processFiles = async (paths: string[]) => {
        const newFiles: FileItem[] = [];

        for (const path of paths) {
            try {
                // Fetch metadata for duration
                const metadata: any = await invoke('get_video_metadata', { filePath: path });

                // Format size
                const sizeBytes = metadata.size || 0;
                const sizeFormatted = sizeBytes > 1024 * 1024 * 1024
                    ? `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                    : `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;

                newFiles.push({
                    id: crypto.randomUUID(),
                    name: path.split('/').pop() || path,
                    path: path,
                    size: sizeFormatted,
                    duration: metadata.duration || 0,
                    totalFrames: metadata.total_frames || undefined,
                    progress: 0,
                    status: 'idle',
                    metadata: metadata
                });
            } catch (error) {
                console.error(`Failed to get metadata for ${path}:`, error);
                // Add anyway with default values? Or skip?
                // Let's add with error status or default
                newFiles.push({
                    id: crypto.randomUUID(),
                    name: path.split('/').pop() || path,
                    path: path,
                    size: "Unknown",
                    duration: 0,
                    progress: 0,
                    status: 'error',
                });
            }
        }

        if (newFiles.length > 0) {
            addFiles(newFiles);
            
            // Auto-search and associate metadata for each file
            for (const file of newFiles) {
                // Run async in background, don't await to avoid blocking
                // Use file.path to ensure we have the full path (handles Windows backslashes)
                autoSearchAndAssociateMetadata(
                    file.path,
                    (id, metadata) => updateMetadata(id, metadata),
                    file.id
                ).catch(error => {
                    console.error(`Failed to auto-associate metadata for ${file.name}:`, error);
                });
            }
        }
    };

    // Setup Tauri file drop listener
    React.useEffect(() => {
        const unlisten = getCurrentWebview().onDragDropEvent((event) => {
            if (event.payload.type === 'over') {
                setIsDragging(true);
            } else if (event.payload.type === 'drop') {
                setIsDragging(false);
                processFiles(event.payload.paths);
            } else {
                setIsDragging(false);
            }
        });

        return () => {
            unlisten.then((f) => f());
        };
    }, []);

    const handleOpenDialog = async () => {
        const selected = await open({
            multiple: true,
            filters: [{
                name: 'Video',
                extensions: ['mp4', 'mkv', 'avi', 'mov']
            }]
        });

        if (selected) {
            const paths = Array.isArray(selected) ? selected : [selected];
            processFiles(paths);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-8">
            <motion.div
                layout
                onClick={handleOpenDialog}
                className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${isDragging
                    ? 'border-primary bg-primary/10'
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                    }`}
                animate={{
                    scale: isDragging ? 1.02 : 1,
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-full bg-background shadow-sm">
                        <AnimatePresence mode='wait'>
                            {isDragging ? (
                                <motion.div
                                    key="drop"
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.5, opacity: 0 }}
                                >
                                    <FileVideo className="w-8 h-8 text-primary" />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="upload"
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.5, opacity: 0 }}
                                >
                                    <Upload className="w-8 h-8 text-muted-foreground" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">
                            {isDragging ? 'Drop videos here' : 'Drag & drop videos here'}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            or click to browse
                        </p>
                    </div>
                </div>
            </motion.div>

            <VideoList />
        </div>
    );
};
