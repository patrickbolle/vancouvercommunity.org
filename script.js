// Simple markdown to HTML converter for our specific format
function parseMarkdown(md) {
    let html = md
        // Headers
        .replace(/^# (.+)$/gm, '<h2 id="$1">$1</h2>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // List items
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr>')
        // Paragraphs (simple)
        .replace(/\n\n/g, '</p><p>');
    
    // Wrap consecutive list items in ul
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    
    return html;
}

// Category files mapping
const categories = [
    { id: 'dinner-supper-clubs', file: 'dinner-supper-clubs.md' },
    { id: 'social-friend-clubs', file: 'social-friend-clubs.md' },
    { id: 'run-clubs', file: 'run-clubs.md' },
    { id: 'board-games', file: 'board-games.md' },
    { id: 'creative-art', file: 'creative-art.md' },
    { id: 'photography', file: 'photography.md' },
    { id: 'film-cinema', file: 'film-cinema.md' },
    { id: 'writing', file: 'writing.md' },
    { id: 'language-exchange', file: 'language-exchange.md' },
    { id: 'hiking-outdoors', file: 'hiking-outdoors.md' },
    { id: 'cycling', file: 'cycling.md' },
    { id: 'dance', file: 'dance.md' },
    { id: 'improv-comedy', file: 'improv-comedy.md' },
    { id: 'music-open-mic', file: 'music-open-mic.md' },
    { id: 'climbing', file: 'climbing.md' },
    { id: 'pickleball', file: 'pickleball.md' },
    { id: 'pottery-ceramics', file: 'pottery-ceramics.md' },
    { id: 'yoga-wellness', file: 'yoga-wellness.md' },
    { id: 'sauna-cold-plunge', file: 'sauna-cold-plunge.md' },
    { id: 'mindfulness-meditation', file: 'mindfulness-meditation.md' },
    { id: 'mens-groups', file: 'mens-groups.md' },
    { id: 'maker-spaces', file: 'maker-spaces.md' },
    { id: 'philosophy-intellectual', file: 'philosophy-intellectual.md' },
    { id: 'book-clubs', file: 'book-clubs.md' },
    { id: 'tech-startup', file: 'tech-startup.md' },
    { id: 'coworking', file: 'coworking.md' },
    { id: 'volunteer', file: 'volunteer.md' },
    { id: 'vinyl-listening-bars', file: 'vinyl-listening-bars.md' },
    { id: 'chess', file: 'chess.md' },
    { id: 'underground-dj', file: 'underground-dj.md' },
    { id: 'poetry-spoken-word', file: 'poetry-spoken-word.md' },
    { id: 'tarot-astrology', file: 'tarot-astrology.md' },
    { id: 'flea-markets-vintage', file: 'flea-markets-vintage.md' },
    { id: 'pub-trivia', file: 'pub-trivia.md' },
    { id: 'zine-risograph', file: 'zine-risograph.md' },
    { id: 'astronomy-stargazing', file: 'astronomy-stargazing.md' },
    { id: 'foraging-nature', file: 'foraging-nature.md' },
    { id: 'birdwatching', file: 'birdwatching.md' },
    { id: 'karaoke', file: 'karaoke.md' },
    { id: 'resources', file: 'resources.md' }
];

// Load all content
async function loadContent() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<p><em>Loading directory...</em></p>';
    
    let allContent = '';
    
    for (const cat of categories) {
        try {
            const response = await fetch(cat.file);
            if (response.ok) {
                const md = await response.text();
                const html = parseMarkdown(md);
                allContent += `<div class="category" id="${cat.id}">${html}<p class="back-to-top"><a href="#top">↑ Back to top</a></p></div>`;
            }
        } catch (e) {
            console.error(`Failed to load ${cat.file}:`, e);
        }
    }
    
    contentArea.innerHTML = allContent || '<p>Failed to load content. <a href="https://github.com/patrickbolle/vancouver-community-directory">View on GitHub</a></p>';
}

// Run on load
document.addEventListener('DOMContentLoaded', loadContent);
