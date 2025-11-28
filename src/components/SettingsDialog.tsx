import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Save, Eye, EyeOff } from 'lucide-react';
import { Store } from '@tauri-apps/plugin-store';

export const SettingsDialog: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [store, setStore] = useState<Store | null>(null);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const _store = await Store.load('settings.json');
                setStore(_store);
                const val = await _store.get<string>('tmdb_api_key');
                if (val) setApiKey(val);
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
            await store.save();
            setIsOpen(false);
        } catch (e) {
            console.error('Failed to save settings', e);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed top-4 right-4 p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
                <Settings className="w-6 h-6" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md bg-background border rounded-xl shadow-lg p-6"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold">Settings</h2>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 rounded-md hover:bg-muted transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
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

                                <div className="flex justify-end pt-4">
                                    <button
                                        onClick={handleSave}
                                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                    >
                                        <Save className="w-4 h-4" />
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};
