import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Save, Eye, EyeOff, Check, X as XIcon, Plus, Trash2, Edit2, FolderOpen } from 'lucide-react';
import { Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Preset, DEFAULT_PRESETS } from '../types/preset';

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
        <>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-2xl bg-background border rounded-xl shadow-lg flex flex-col max-h-[80vh]"
                        >
                            <div className="flex items-center justify-between p-6 border-b">
                                <h2 className="text-xl font-semibold">
                                    {editingPreset ? (editingPreset.id === 'new' ? 'New Preset' : 'Edit Preset') : 'Settings'}
                                </h2>
                                <button
                                    onClick={() => {
                                        if (editingPreset) setEditingPreset(null);
                                        else setIsOpen(false);
                                    }}
                                    className="p-1 rounded-md hover:bg-muted transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {!editingPreset && (
                                <div className="flex border-b">
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

                            <div className="p-6 overflow-y-auto flex-1">
                                {editingPreset ? (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Name</label>
                                            <input
                                                type="text"
                                                value={editingPreset.name}
                                                onChange={e => setEditingPreset({ ...editingPreset, name: e.target.value })}
                                                className="w-full px-3 py-2 rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                placeholder="My Custom Preset"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Description</label>
                                            <input
                                                type="text"
                                                value={editingPreset.description || ''}
                                                onChange={e => setEditingPreset({ ...editingPreset, description: e.target.value })}
                                                className="w-full px-3 py-2 rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                placeholder="Optional description"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Container</label>
                                                <select
                                                    value={editingPreset.container}
                                                    onChange={e => setEditingPreset({ ...editingPreset, container: e.target.value as any })}
                                                    className="w-full px-3 py-2 rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="mp4" className="bg-background">MP4</option>
                                                    <option value="mkv" className="bg-background">MKV</option>
                                                    <option value="avi" className="bg-background">AVI</option>
                                                    <option value="mov" className="bg-background">MOV</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Video Codec</label>
                                                <select
                                                    value={editingPreset.video.codec}
                                                    onChange={e => setEditingPreset({ ...editingPreset, video: { ...editingPreset.video, codec: e.target.value } })}
                                                    className="w-full px-3 py-2 rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    {getAvailableEncoders().map((group) => (
                                                        <optgroup key={group.label} label={group.label}>
                                                            {group.options.map((opt) => (
                                                                <option key={opt.value} value={opt.value} className="bg-background">
                                                                    {opt.label}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                </select>
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
                                                <select
                                                    value={editingPreset.video.preset || 'medium'}
                                                    onChange={e => setEditingPreset({ ...editingPreset, video: { ...editingPreset.video, preset: e.target.value } })}
                                                    className="w-full px-3 py-2 rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="ultrafast" className="bg-background">Ultrafast</option>
                                                    <option value="superfast" className="bg-background">Superfast</option>
                                                    <option value="veryfast" className="bg-background">Veryfast</option>
                                                    <option value="faster" className="bg-background">Faster</option>
                                                    <option value="fast" className="bg-background">Fast</option>
                                                    <option value="medium" className="bg-background">Medium (Default)</option>
                                                    <option value="slow" className="bg-background">Slow</option>
                                                    <option value="slower" className="bg-background">Slower</option>
                                                    <option value="veryslow" className="bg-background">Veryslow</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Audio Strategy</label>
                                                <select
                                                    value={editingPreset.audio.strategy || 'first_track'}
                                                    onChange={e => setEditingPreset({ ...editingPreset, audio: { ...editingPreset.audio, strategy: e.target.value as any } })}
                                                    className="w-full px-3 py-2 rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="first_track" className="bg-background">First Track (Default)</option>
                                                    <option value="copy_all" className="bg-background">Copy All Tracks</option>
                                                    <option value="convert_all" className="bg-background">Convert All Tracks</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Subtitle Strategy</label>
                                                <select
                                                    value={editingPreset.subtitle?.strategy || 'ignore'}
                                                    onChange={e => setEditingPreset({ ...editingPreset, subtitle: { ...editingPreset.subtitle, strategy: e.target.value as any } })}
                                                    className="w-full px-3 py-2 rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="ignore" className="bg-background">Ignore</option>
                                                    <option value="copy_all" className="bg-background">Copy All</option>
                                                    <option value="burn_in" className="bg-background">Burn In (Hardsub)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Audio Codec</label>
                                                <select
                                                    value={editingPreset.audio.codec}
                                                    onChange={e => setEditingPreset({ ...editingPreset, audio: { ...editingPreset.audio, codec: e.target.value } })}
                                                    className="w-full px-3 py-2 rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    disabled={editingPreset.audio.strategy === 'copy_all'}
                                                >
                                                    <option value="aac" className="bg-background">AAC</option>
                                                    <option value="ac3" className="bg-background">AC3</option>
                                                    <option value="copy" className="bg-background">Copy (Passthrough)</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Audio Bitrate</label>
                                                <select
                                                    value={editingPreset.audio.bitrate || '128k'}
                                                    onChange={e => setEditingPreset({ ...editingPreset, audio: { ...editingPreset.audio, bitrate: e.target.value } })}
                                                    className="w-full px-3 py-2 rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    disabled={editingPreset.audio.codec === 'copy' || editingPreset.audio.strategy === 'copy_all'}
                                                >
                                                    <option value="64k" className="bg-background">64k</option>
                                                    <option value="128k" className="bg-background">128k</option>
                                                    <option value="192k" className="bg-background">192k</option>
                                                    <option value="320k" className="bg-background">320k</option>
                                                </select>
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
                                                <input
                                                    id="tmdb-key"
                                                    type={showApiKey ? "text" : "password"}
                                                    value={apiKey}
                                                    onChange={(e) => setApiKey(e.target.value)}
                                                    placeholder="Enter your TMDB API Key"
                                                    className="w-full px-3 py-2 pr-10 rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                                            <select
                                                id="preset-select"
                                                value={defaultPresetId}
                                                onChange={(e) => setDefaultPresetId(e.target.value)}
                                                className="w-full px-3 py-2 rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            >
                                                {presets.map((preset) => (
                                                    <option key={preset.id} value={preset.id} className="bg-background">
                                                        {preset.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-muted-foreground">
                                                This preset will be applied to all new videos added.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Default Output Directory</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={defaultOutputDir}
                                                    readOnly
                                                    placeholder="Same as input file (Default)"
                                                    className="flex-1 px-3 py-2 rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                                />
                                                <button
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
                                                    className="p-2 rounded-md border hover:bg-muted transition-colors"
                                                    title="Select Folder"
                                                >
                                                    <FolderOpen className="w-5 h-5" />
                                                </button>
                                                {defaultOutputDir && (
                                                    <button
                                                        onClick={() => setDefaultOutputDir('')}
                                                        className="p-2 rounded-md border hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                        title="Clear (Use Input Directory)"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                If set, all converted videos will be saved here. Otherwise, they are saved next to the original file.
                                            </p>
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
                                            <button
                                                onClick={() => setEditingPreset({
                                                    id: crypto.randomUUID(),
                                                    name: 'New Preset',
                                                    container: 'mp4',
                                                    video: { codec: 'libx264', preset: 'medium', crf: 23 },
                                                    audio: { codec: 'aac', bitrate: '128k' }
                                                })}
                                                className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors"
                                            >
                                                <Plus className="w-3 h-3" /> New Preset
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {presets.map((preset) => (
                                                <div key={preset.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                                                    <div>
                                                        <div className="font-medium text-sm">{preset.name}</div>
                                                        <div className="text-xs text-muted-foreground">{preset.description || `${preset.container} • ${preset.video.codec}`}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => setEditingPreset(preset)}
                                                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setPresets(prev => prev.filter(p => p.id !== preset.id))}
                                                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t bg-muted/20">
                                <div className="flex justify-end gap-2">
                                    {editingPreset ? (
                                        <>
                                            <button
                                                onClick={() => setEditingPreset(null)}
                                                className="px-4 py-2 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSavePreset}
                                                className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                            >
                                                <Save className="w-4 h-4" />
                                                Save Preset
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={handleSave}
                                            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                        >
                                            <Save className="w-4 h-4" />
                                            Save Changes
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};
