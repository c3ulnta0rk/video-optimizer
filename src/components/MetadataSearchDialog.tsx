import React, { useState, useEffect } from 'react';
import { Search, X, Film, Calendar, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Store } from '@tauri-apps/plugin-store';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from './ui/Dialog';

interface MovieSearchResult {
    id: number;
    title: string;
    release_date?: string;
    overview: string;
    poster_path?: string;
}

interface MetadataSearchDialogProps {
    isOpen: boolean;
    onClose: () => void;
    initialQuery: string;
    onSelect: (movie: MovieSearchResult) => void;
}

export const MetadataSearchDialog: React.FC<MetadataSearchDialogProps> = ({
    isOpen,
    onClose,
    initialQuery,
    onSelect
}) => {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<MovieSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        if (isOpen) {
            setQuery(initialQuery);
            setResults([]);
            setError(null);
            loadApiKey();
        }
    }, [isOpen, initialQuery]);

    const loadApiKey = async () => {
        try {
            const store = await Store.load('settings.json');
            const key = await store.get<string>('tmdb_api_key');
            if (key) setApiKey(key);
            else setError("TMDB API Key not found. Please set it in Settings.");
        } catch (e) {
            console.error(e);
        }
    };

    const handleSearch = async () => {
        if (!query.trim() || !apiKey) return;

        setIsLoading(true);
        setError(null);
        try {
            const res = await invoke<MovieSearchResult[]>('search_movie_command', {
                query,
                apiKey
            });
            setResults(res);
        } catch (e: any) {
            setError(e.toString());
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-search on open if query is present and key exists
    useEffect(() => {
        if (isOpen && apiKey && query && results.length === 0 && !isLoading && !error) {
            // Optional: Auto search. Let's wait for user to press enter or click search to avoid spamming if query is bad.
            // But for better UX, maybe we can auto-search if query looks "clean".
            // For now, let's just let user search.
        }
    }, [isOpen, apiKey]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center justify-between w-full">
                        <DialogTitle className="flex items-center gap-2">
                            <Film className="w-5 h-5" />
                            Search Metadata
                        </DialogTitle>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="p-4 border-b bg-muted/30">
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Movie title..."
                            className="flex-1"
                            autoFocus
                        />
                        <Button
                            onClick={handleSearch}
                            disabled={isLoading || !apiKey}
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                            Search
                        </Button>
                    </div>
                    {error && <p className="text-destructive text-sm mt-2">{error}</p>}
                </div>

                <DialogBody>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.map((movie) => (
                            <div
                                key={movie.id}
                                onClick={() => onSelect(movie)}
                                className="flex gap-4 p-3 rounded-lg border bg-card hover:border-primary cursor-pointer transition-all hover:shadow-md group"
                            >
                                <div className="w-24 h-36 bg-muted rounded-md flex-shrink-0 overflow-hidden">
                                    {movie.poster_path ? (
                                        <img
                                            src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                                            alt={movie.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                            <Film className="w-8 h-8 opacity-20" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-base group-hover:text-primary truncate">
                                        {movie.title}
                                    </h3>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                        <Calendar className="w-3 h-3" />
                                        {movie.release_date?.split('-')[0] || 'Unknown'}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2 line-clamp-4">
                                        {movie.overview}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {results.length === 0 && !isLoading && !error && (
                            <div className="col-span-full text-center py-12 text-muted-foreground">
                                {apiKey ? "Enter a title to search..." : "Please configure TMDB API Key in Settings."}
                            </div>
                        )}
                    </div>
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
};
