import { invoke } from '@tauri-apps/api/core';
import { Store } from '@tauri-apps/plugin-store';

interface MovieSearchResult {
    id: number;
    title: string;
    release_date?: string;
    overview: string;
    poster_path?: string;
}

/**
 * Extracts the movie title and year intelligently from a filename
 * Returns: { title: string, year: string | null }
 */
export const extractMovieTitleAndYear = (filename: string): { title: string; year: string | null } => {
    // Extract just the filename (without path)
    const fileName = filename.split(/[/\\]/).pop() || filename;
    
    // Remove extension
    const withoutExt = fileName.replace(/(\.[\w\d]+)$/, '');
    
    // Replace dots, underscores, and hyphens with spaces
    const normalized = withoutExt.replace(/[._-]/g, ' ');
    
    // Split into words
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    
    // Keywords that indicate we've reached the end of the title (stop immediately)
    const stopKeywords = [
        'MULTI', 'MULTi', 'VF', 'VF2', 'VFF', 'VO', 'VOSTFR', 'FRENCH', 'TRUEFRENCH',
        '1080p', '720p', '480p', '2160p', '4K', '4k',
        'BLURAY', 'BLU-RAY', 'BLURAY', 'WEB-DL', 'WEBRIP', 'DVDRIP', 'HDRIP', 'BDRIP', 'HDTV', 'AMZN', 'NF', 'DSNP',
        'HEVC', 'X264', 'X265', 'H264', 'H265', 'AV1', 'VP9',
        'DTS', 'AC3', 'EAC3', 'AAC', 'TRUEHD', 'FLAC', 'OPUS', 'DDP5', 'DDP',
        'HDMA', 'HDR', '10BIT', 'ULSHD', 'REMUX', 'REPACK', 'PROPER'
    ];
    
    // Words to ignore (skip them but continue collecting)
    const ignoreWords = ['REMASTERED', 'EXTENDED', 'DIRECTOR', 'CUT'];
    
    const titleWords: string[] = [];
    let foundYear: string | null = null;
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordUpper = word.toUpperCase();
        
        // Check if it's a technical keyword - STOP HERE
        if (stopKeywords.includes(wordUpper)) {
            break;
        }
        
        // Check if it's a year (4 digits starting with 19 or 20)
        if (/^(19|20)\d{2}$/.test(word)) {
            // If we already have title words, this is likely the year after the title
            if (titleWords.length > 0) {
                const nextWord = i + 1 < words.length ? words[i + 1].toUpperCase() : '';
                if (stopKeywords.includes(nextWord)) {
                    // Next word is technical, so stop before the year
                    foundYear = word;
                    break;
                }
                // Year found after title
                foundYear = word;
                break;
            }
        }
        
        // Skip ignore words
        if (ignoreWords.includes(wordUpper)) {
            continue;
        }
        
        // Add word to title
        titleWords.push(word);
    }
    
    // Join title words and clean up
    let title = titleWords.join(' ').trim();
    
    // Remove trailing year if present (in case it was added)
    title = title.replace(/\s+(19|20)\d{2}$/, '');
    
    // If we didn't find anything meaningful, fallback to first few words
    if (!title || title.length < 2) {
        // Take first 5 words as fallback, but stop at technical keywords
        const fallbackWords: string[] = [];
        for (let i = 0; i < Math.min(5, words.length); i++) {
            if (stopKeywords.includes(words[i].toUpperCase())) {
                break;
            }
            fallbackWords.push(words[i]);
        }
        title = fallbackWords.join(' ').trim();
    }
    
    return { title, year: foundYear };
};

/**
 * Automatically searches and associates metadata for a file
 * Returns the movie data if found and auto-selected, null otherwise
 */
export const autoSearchAndAssociateMetadata = async (
    filename: string,
    updateMetadata: (id: string, metadata: { tmdbId: number; posterPath?: string; overview?: string; releaseDate?: string }) => void,
    fileId: string
): Promise<MovieSearchResult | null> => {
    try {
        // Extract title and year
        const { title, year } = extractMovieTitleAndYear(filename);
        
        if (!title || title.length < 2) {
            return null; // Title too short, skip auto-search
        }

        // Load API key
        const store = await Store.load('settings.json');
        const apiKey = await store.get<string>('tmdb_api_key');
        
        if (!apiKey) {
            return null; // No API key configured
        }

        // Search for the movie
        const results = await invoke<MovieSearchResult[]>('search_movie_command', {
            query: title,
            apiKey
        });

        if (results.length === 0) {
            return null; // No results found
        }

        let movieToSelect: MovieSearchResult | null = null;

        if (results.length === 1) {
            // Single result - auto-select it
            movieToSelect = results[0];
        } else if (year) {
            // Multiple results - try to find one matching the year
            const matchingYear = results.find(movie => {
                const movieYear = movie.release_date?.split('-')[0];
                return movieYear === year;
            });
            if (matchingYear) {
                movieToSelect = matchingYear;
            }
        }

        if (movieToSelect) {
            // Associate the metadata
            updateMetadata(fileId, {
                tmdbId: movieToSelect.id,
                posterPath: movieToSelect.poster_path,
                overview: movieToSelect.overview,
                releaseDate: movieToSelect.release_date
            });
            return movieToSelect;
        }

        return null; // No auto-match found
    } catch (error) {
        console.error('Failed to auto-search metadata:', error);
        return null;
    }
};

