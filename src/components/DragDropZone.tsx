import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileVideo } from 'lucide-react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { VideoList } from './VideoList';

interface FileItem {
    name: string;
    path: string;
}

export const DragDropZone: React.FC = () => {
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState<FileItem[]>([]);

    // Setup Tauri file drop listener
    React.useEffect(() => {
        const unlisten = getCurrentWebview().onDragDropEvent((event) => {
            if (event.payload.type === 'over') {
                setIsDragging(true);
            } else if (event.payload.type === 'drop') {
                setIsDragging(false);
                const newFiles = event.payload.paths.map((path) => ({
                    name: path.split('/').pop() || path,
                    path: path,
                }));
                setFiles((prev) => [...prev, ...newFiles]);
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
            const newFiles = paths.map((path) => ({
                name: path.split('/').pop() || path,
                path: path,
            }));
            setFiles((prev) => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
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

            <VideoList files={files} onRemove={removeFile} />
        </div>
    );
};
