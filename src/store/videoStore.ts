import { create } from 'zustand';

export interface ConversionSettingsOverride {
    videoCodec?: string;
    audioStrategy?: string; // 'copy_all', 'convert_all', 'first_track'
    subtitleStrategy?: string; // 'copy_all', 'burn_in', 'ignore'
    audioCodec?: string;
    audioBitrate?: string;
    outputDir?: string;
    outputName?: string;
    crf?: number;
    preset?: string;
    profile?: string;
    tune?: string;
    container?: string;
}

export interface FileItem {
    id: string;
    name: string;
    path: string;
    size: string;
    duration: number; // in seconds
    totalFrames?: number; // Total number of frames in the video
    progress: number; // 0-100
    status: 'idle' | 'queued' | 'converting' | 'completed' | 'error';
    metadata?: any; // Placeholder for full metadata
    tmdbId?: number;
    posterPath?: string;
    overview?: string;
    releaseDate?: string;
    conversionSettings?: ConversionSettingsOverride;
}

interface VideoStore {
    files: FileItem[];
    addFiles: (newFiles: FileItem[]) => void;
    removeFile: (id: string) => void;
    updateProgress: (id: string, progress: number) => void;
    updateStatus: (id: string, status: FileItem['status']) => void;
    updateFileSettings: (id: string, settings: ConversionSettingsOverride) => void;
    updateMetadata: (id: string, metadata: Partial<FileItem>) => void;
    clearFiles: () => void;
}

export const useVideoStore = create<VideoStore>((set) => ({
    files: [],
    addFiles: (newFiles) => set((state) => ({
        files: [...state.files, ...newFiles]
    })),
    removeFile: (id) => set((state) => ({
        files: state.files.filter((f) => f.id !== id)
    })),
    updateProgress: (id, progress) => set((state) => ({
        files: state.files.map((f) =>
            f.id === id ? { ...f, progress } : f
        )
    })),
    updateStatus: (id, status) => set((state) => ({
        files: state.files.map((f) =>
            f.id === id ? { ...f, status } : f
        )
    })),
    updateFileSettings: (id, settings) => set((state) => ({
        files: state.files.map((f) =>
            f.id === id ? { ...f, conversionSettings: { ...f.conversionSettings, ...settings } } : f
        )
    })),
    updateMetadata: (id, metadata) => set((state) => ({
        files: state.files.map((f) =>
            f.id === id ? { ...f, ...metadata } : f
        )
    })),
    clearFiles: () => set({ files: [] }),
}));
