export interface Preset {
    id: string;
    name: string;
    description?: string;
    container: 'mp4' | 'mkv' | 'avi' | 'mov';
    video: {
        codec: string; // 'libx264', 'h264_nvenc', etc.
        bitrate?: string; // '2M', '5000k'
        crf?: number; // 0-51
        preset?: string; // 'fast', 'slow', etc.
    };
    audio: {
        codec: string; // 'aac', 'ac3', 'copy'
        bitrate?: string; // '128k', '320k'
        strategy?: 'copy_all' | 'convert_all' | 'first_track'; // New strategy
    };
    subtitle?: {
        strategy: 'copy_all' | 'burn_in' | 'ignore'; // New strategy
    };
}

export const DEFAULT_PRESETS: Preset[] = [
    {
        id: 'default-high',
        name: 'High Quality (H.264)',
        description: 'Standard high quality MP4 conversion',
        container: 'mp4',
        video: {
            codec: 'libx264',
            crf: 23,
            preset: 'medium'
        },
        audio: {
            codec: 'aac',
            bitrate: '192k'
        }
    },
    {
        id: 'fast-gpu',
        name: 'Fast GPU (NVENC)',
        description: 'Hardware accelerated conversion',
        container: 'mp4',
        video: {
            codec: 'h264_nvenc',
            preset: 'p4'
        },
        audio: {
            codec: 'aac',
            bitrate: '128k'
        }
    }
];
