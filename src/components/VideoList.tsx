import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileVideo, Trash2, Film, HardDrive } from 'lucide-react';
import { ProgressChart } from './ProgressChart';

interface FileItem {
    name: string;
    path: string;
    size?: string; // Placeholder for now
    progress?: number; // Optional progress for now
}

interface VideoListProps {
    files: FileItem[];
    onRemove: (index: number) => void;
}

export const VideoList: React.FC<VideoListProps> = ({ files, onRemove }) => {
    return (
        <div className="w-full max-w-4xl mx-auto mt-8 px-4">
            <AnimatePresence mode='popLayout'>
                {files.map((file, index) => (
                    <motion.div
                        key={`${file.path}-${index}`}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="group relative flex items-center gap-4 p-4 mb-3 bg-card border rounded-xl shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="relative">
                            <div className="p-3 rounded-lg bg-primary/10 text-primary">
                                <FileVideo className="w-6 h-6" />
                            </div>
                            {/* Show progress if available */}
                            {file.progress !== undefined && (
                                <div className="absolute -top-2 -right-2 bg-background rounded-full shadow-sm">
                                    <ProgressChart progress={file.progress} size={32} strokeWidth={4} />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate text-foreground">{file.name}</h3>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <HardDrive className="w-3 h-3" />
                                    {file.path}
                                </span>
                                {/* Placeholders for metadata that we'll fetch later */}
                                <span className="flex items-center gap-1">
                                    <Film className="w-3 h-3" />
                                    MP4
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(index);
                            }}
                            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>

            {files.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-muted-foreground py-12"
                >
                    <p>No videos added yet.</p>
                </motion.div>
            )}
        </div>
    );
};
