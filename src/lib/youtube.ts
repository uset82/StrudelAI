
import { JSDOM } from 'jsdom';

export interface VideoMetadata {
    title: string;
    artist: string;
    description: string;
}

export async function getVideoMetadata(url: string): Promise<VideoMetadata | null> {
    try {
        console.log(`[YouTube] Fetching metadata for: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            console.error(`[YouTube] Failed to fetch page: ${response.status}`);
            return null;
        }

        const html = await response.text();
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        // Try to get title
        let title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
            doc.title ||
            'Unknown Title';

        // Clean title (remove " - YouTube")
        title = title.replace(' - YouTube', '');

        // Try to guess artist from title (Format: Artist - Song)
        let artist = 'Unknown Artist';
        if (title.includes('-')) {
            const parts = title.split('-');
            artist = parts[0].trim();
            title = parts.slice(1).join('-').trim();
        } else if (title.includes(':')) {
            const parts = title.split(':');
            artist = parts[0].trim();
            title = parts.slice(1).join(':').trim();
        }

        // Get description
        const description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

        console.log(`[YouTube] Found: ${artist} - ${title}`);

        return {
            title,
            artist,
            description
        };

    } catch (error) {
        console.error('[YouTube] Error fetching metadata:', error);
        return null;
    }
}
