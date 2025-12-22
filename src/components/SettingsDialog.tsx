import React, { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Check, X as XIcon, Plus, Trash2, Edit2, FolderOpen } from 'lucide-react';
import { Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Preset, DEFAULT_PRESETS } from '../types/preset';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from './ui/Dialog';

interface GpuCapabilities {
    has_nvenc: boolean;
    has_qsv: boolean;
    has_vaapi: boolean;
    has_videotoolbox: boolean;
    has_amf: boolean;
}

const GpuStatusBadge = ({ label, active }: { label: string; active: boolean }) => (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${active ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' : 'bg-muted/50 border-muted text-muted-foreground'}`}>
        <span className="text-xs font-medium">{label}</span>
        {active ? <Check className="w-3 h-3" /> : <XIcon className="w-3 h-3 opacity-50" />}
    </div>
);

interface SettingsDialogProps {
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen: controlledIsOpen, onOpenChange }) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const setIsOpen = (open: boolean) => {
        if (onOpenChange) {
            onOpenChange(open);
        } else {
            setInternalIsOpen(open);
        }
    };
    const [activeTab, setActiveTab] = useState<'general' | 'presets'>('general');

    // General Settings
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [defaultPresetId, setDefaultPresetId] = useState('default-high');
    const [defaultOutputDir, setDefaultOutputDir] = useState('');

    // Presets
    const [presets, setPresets] = useState<Preset[]>([]);
    const [editingPreset, setEditingPreset] = useState<Preset | null>(null);

    // System
    const [store, setStore] = useState<Store | null>(null);
    const [gpuCaps, setGpuCaps] = useState<GpuCapabilities>({
        has_nvenc: false,
        has_qsv: false,
        has_vaapi: false,
        has_videotoolbox: false,
        has_amf: false
    });

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const _store = await Store.load('settings.json');
                setStore(_store);

                const val = await _store.get<string>('tmdb_api_key');
                if (val) setApiKey(val);

                const presetId = await _store.get<string>('default_preset_id');
                if (presetId) setDefaultPresetId(presetId);

                const outputDir = await _store.get<string>('default_output_dir');
                if (outputDir) setDefaultOutputDir(outputDir);

                // Load Presets
                const savedPresets = await _store.get<Preset[]>('presets');
                if (savedPresets) {
                    setPresets(savedPresets);
                } else {
                    setPresets(DEFAULT_PRESETS);
                }

                // Load GPU capabilities
                const caps = await invoke<GpuCapabilities>('get_gpu_capabilities_command');
                setGpuCaps(caps);
            } catch (e) {
                console.error('Failed to load settings', e);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        if (!store) return;
        try {
            await store.set('tmdb_api_key', apiKey);
            await store.set('default_preset_id', defaultPresetId);
            await store.set('default_output_dir', defaultOutputDir);
            await store.set('presets', presets);
            await store.save();
            setIsOpen(false);

            // Emit event to notify other components that presets have been updated
            window.dispatchEvent(new CustomEvent('presets-updated'));
        } catch (e) {
            console.error('Failed to save settings', e);
        }
    };

    const handleSavePreset = () => {
        if (!editingPreset) return;

        setPresets(prev => {
            const index = prev.findIndex(p => p.id === editingPreset.id);
            if (index >= 0) {
                const newPresets = [...prev];
                newPresets[index] = editingPreset;
                return newPresets;
            } else {
                return [...prev, editingPreset];
            }
        });
        setEditingPreset(null);
    };

    const getAvailableEncoders = () => {
        const encoders = [
            {
                label: 'H.264 (AVC)', options: [
                    { value: 'libx264', label: 'CPU (x264) - Universal, High Quality' }
                ]
            },
            {
                label: 'H.265 (HEVC)', options: [
                    { value: 'libx265', label: 'CPU (x265) - High Efficiency, Slow' }
                ]
            },
            {
                label: 'AV1', options: [
                    { value: 'libsvtav1', label: 'CPU (SVT-AV1) - Next Gen, Efficient' },
                    { value: 'libaom-av1', label: 'CPU (AOM-AV1) - Reference, Very Slow' }
                ]
            },
            {
                label: 'VP9', options: [
                    { value: 'libvpx-vp9', label: 'CPU (VP9) - Web Friendly' }
                ]
            }
        ];

        // Helper to add hardware encoders
        const addHw = (categoryLabel: string, value: string, label: string) => {
            const category = encoders.find(e => e.label === categoryLabel);
            if (category) {
                category.options.push({ value, label });
            }
        };

        if (gpuCaps.has_nvenc) {
            addHw('H.264 (AVC)', 'h264_nvenc', 'NVIDIA NVENC (H.264)');
            addHw('H.265 (HEVC)', 'hevc_nvenc', 'NVIDIA NVENC (HEVC)');
            // Note: AV1 NVENC is only on RTX 40 series, we assume if nvenc is present we might have it, 
            // but ideally we should check. For now, let's add it if nvenc is there, user will get error if not supported.
            // Or maybe safer to leave it out until we have specific detection. 
            // Let's stick to H264/HEVC for HW for now as they are most common.
        }

        if (gpuCaps.has_qsv) {
            addHw('H.264 (AVC)', 'h264_qsv', 'Intel QuickSync (H.264)');
            addHw('H.265 (HEVC)', 'hevc_qsv', 'Intel QuickSync (HEVC)');
            addHw('VP9', 'vp9_qsv', 'Intel QuickSync (VP9)');
        }

        if (gpuCaps.has_vaapi) {
            addHw('H.264 (AVC)', 'h264_vaapi', 'VAAPI (H.264)');
            addHw('H.265 (HEVC)', 'hevc_vaapi', 'VAAPI (HEVC)');
            addHw('VP9', 'vp9_vaapi', 'VAAPI (VP9)');
        }

        if (gpuCaps.has_videotoolbox) {
            addHw('H.264 (AVC)', 'h264_videotoolbox', 'Apple VideoToolbox (H.264)');
            addHw('H.265 (HEVC)', 'hevc_videotoolbox', 'Apple VideoToolbox (HEVC)');
            encoders.push({
                label: 'ProRes', options: [
                    { value: 'prores_videotoolbox', label: 'Apple VideoToolbox (ProRes)' }
                ]
            });
        }

        if (gpuCaps.has_amf) {
            addHw('H.264 (AVC)', 'h264_amf', 'AMD AMF (H.264)');
            addHw('H.265 (HEVC)', 'hevc_amf', 'AMD AMF (HEVC)');
        }

        return encoders;
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{editingPreset ? (editingPreset.id === 'new' ? 'New Preset' : 'Edit Preset') : 'Settings'}</DialogTitle>
                </DialogHeader>

                {!editingPreset && (
                    <div className="flex border-b px-6">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                            General
                        </button>
                        <button
                            onClick={() => setActiveTab('presets')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'presets' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                            Presets
                        </button>
                    </div>
                )}

                <DialogBody>
                    {editingPreset ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Name</label>
                                <Input
                                    type="text"
                                    value={editingPreset.name}
                                    onChange={e => setEditingPreset({ ...editingPreset, name: e.target.value })}
                                    placeholder="My Custom Preset"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Description</label>
                                <Input
                                    type="text"
                                    value={editingPreset.description || ''}
                                    onChange={e => setEditingPreset({ ...editingPreset, description: e.target.value })}
                                    placeholder="Optional description"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Container</label>
                                    <Select
                                        value={editingPreset.container}
                                        onChange={(val) => setEditingPreset({ ...editingPreset, container: val as any })}
                                        options={[
                                            { value: 'mp4', label: 'MP4' },
                                            { value: 'mkv', label: 'MKV' },
                                            { value: 'avi', label: 'AVI' },
                                            { value: 'mov', label: 'MOV' }
                                        ]}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Video Codec</label>
                                    <Select
                                        value={editingPreset.video.codec}
                                        onChange={(val) => setEditingPreset({ ...editingPreset, video: { ...editingPreset.video, codec: val } })}
                                        options={getAvailableEncoders()}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-sm font-medium">Quality (CRF)</label>
                                        <span className="text-xs text-primary font-mono">{editingPreset.video.crf || 23}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="18"
                                        max="28"
                                        step="1"
                                        value={editingPreset.video.crf || 23}
                                        onChange={e => setEditingPreset({ ...editingPreset, video: { ...editingPreset.video, crf: parseInt(e.target.value) } })}
                                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                        title="Lower is better quality, Higher is smaller size"
                                    />
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>High Quality</span>
                                        <span>Small Size</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Preset (Speed)</label>
                                    <Select
                                        value={editingPreset.video.preset || 'medium'}
                                        onChange={(val) => setEditingPreset({ ...editingPreset, video: { ...editingPreset.video, preset: val } })}
                                        options={[
                                            { value: 'ultrafast', label: 'Ultrafast' },
                                            { value: 'superfast', label: 'Superfast' },
                                            { value: 'veryfast', label: 'Veryfast' },
                                            { value: 'faster', label: 'Faster' },
                                            { value: 'fast', label: 'Fast' },
                                            { value: 'medium', label: 'Medium (Default)' },
                                            { value: 'slow', label: 'Slow' },
                                            { value: 'slower', label: 'Slower' },
                                            { value: 'veryslow', label: 'Veryslow' }
                                        ]}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Audio Strategy</label>
                                    <Select
                                        value={editingPreset.audio.strategy || 'first_track'}
                                        onChange={(val) => setEditingPreset({ ...editingPreset, audio: { ...editingPreset.audio, strategy: val as any } })}
                                        options={[
                                            { value: 'first_track', label: 'First Track (Default)' },
                                            { value: 'copy_all', label: 'Copy All Tracks' },
                                            { value: 'convert_all', label: 'Convert All Tracks' }
                                        ]}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Subtitle Strategy</label>
                                    <Select
                                        value={editingPreset.subtitle?.strategy || 'ignore'}
                                        onChange={(val) => setEditingPreset({ ...editingPreset, subtitle: { ...editingPreset.subtitle, strategy: val as any } })}
                                        options={[
                                            { value: 'ignore', label: 'Ignore' },
                                            { value: 'copy_all', label: 'Copy All' },
                                            { value: 'burn_in', label: 'Burn In (Hardsub)' }
                                        ]}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Audio Codec</label>
                                    <Select
                                        value={editingPreset.audio.codec}
                                        onChange={(val) => setEditingPreset({ ...editingPreset, audio: { ...editingPreset.audio, codec: val } })}
                                        disabled={editingPreset.audio.strategy === 'copy_all'}
                                        options={[
                                            { value: 'aac', label: 'AAC' },
                                            { value: 'ac3', label: 'AC3' },
                                            { value: 'copy', label: 'Copy (Passthrough)' }
                                        ]}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Audio Bitrate</label>
                                    <Select
                                        value={editingPreset.audio.bitrate || '128k'}
                                        onChange={(val) => setEditingPreset({ ...editingPreset, audio: { ...editingPreset.audio, bitrate: val } })}
                                        disabled={editingPreset.audio.codec === 'copy' || editingPreset.audio.strategy === 'copy_all'}
                                        options={[
                                            { value: '64k', label: '64k' },
                                            { value: '128k', label: '128k' },
                                            { value: '192k', label: '192k' },
                                            { value: '320k', label: '320k' }
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'general' ? (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="tmdb-key" className="text-sm font-medium">
                                    TMDB API Key
                                </label>
                                <div className="relative">
                                    <Input
                                        id="tmdb-key"
                                        type={showApiKey ? "text" : "password"}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Enter your TMDB API Key"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                                    >
                                        {showApiKey ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Required for automatic movie metadata and artwork.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="preset-select" className="text-sm font-medium">
                                    Default Preset
                                </label>
                                <Select
                                    value={defaultPresetId}
                                    onChange={(val) => setDefaultPresetId(val)}
                                    options={presets.map(preset => ({
                                        value: preset.id,
                                        label: preset.name
                                    }))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    This preset will be applied to all new videos added.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Default Output Directory</label>
                                <div className="flex gap-2">
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            value={defaultOutputDir}
                                            readOnly
                                            placeholder="Same as input file (Default)"
                                            className="flex-1"
                                        />
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={async () => {
                                                const selected = await open({
                                                    directory: true,
                                                    multiple: false,
                                                    defaultPath: defaultOutputDir || undefined
                                                });
                                                if (selected && typeof selected === 'string') {
                                                    setDefaultOutputDir(selected);
                                                } else if (selected === null) {
                                                    // User cancelled, do nothing or clear? 
                                                    // Let's allow clearing if they want to reset to default
                                                }
                                            }}
                                            title="Select Folder"
                                        >
                                            <FolderOpen className="w-5 h-5" />
                                        </Button>
                                        {defaultOutputDir && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setDefaultOutputDir('')}
                                                className="hover:bg-destructive/10 hover:text-destructive"
                                                title="Clear (Use Input Directory)"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        If set, all converted videos will be saved here. Otherwise, they are saved next to the original file.
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium">Hardware Acceleration</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <GpuStatusBadge label="NVIDIA NVENC" active={gpuCaps.has_nvenc} />
                                    <GpuStatusBadge label="Intel QSV" active={gpuCaps.has_qsv} />
                                    <GpuStatusBadge label="VAAPI (AMD/Intel)" active={gpuCaps.has_vaapi} />
                                    <GpuStatusBadge label="macOS VideoToolbox" active={gpuCaps.has_videotoolbox} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-medium">Conversion Presets</h3>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setEditingPreset({
                                        id: crypto.randomUUID(),
                                        name: 'New Preset',
                                        container: 'mp4',
                                        video: { codec: 'libx264', preset: 'medium', crf: 23 },
                                        audio: { codec: 'aac', bitrate: '128k' }
                                    })}
                                    className="h-7 text-xs"
                                >
                                    <Plus className="w-3 h-3" /> New Preset
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {presets.map((preset) => (
                                    <div key={preset.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                                        <div>
                                            <div className="font-medium text-sm">{preset.name}</div>
                                            <div className="text-xs text-muted-foreground">{preset.description || `${preset.container} • ${preset.video.codec}`}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setEditingPreset(preset)}
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setPresets(prev => prev.filter(p => p.id !== preset.id))}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </DialogBody>

                <DialogFooter>
                    <div className="flex justify-end gap-2 w-full">
                        {editingPreset ? (
                            <>
                                <Button
                                    variant="ghost"
                                    onClick={() => setEditingPreset(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSavePreset}
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Preset
                                </Button>
                            </>
                        ) : (
                            <Button
                                onClick={handleSave}
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
