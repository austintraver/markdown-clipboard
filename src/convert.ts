import TurndownService from 'turndown';
import { gfm } from '@joplin/turndown-plugin-gfm';

/**
 * Windows CF_HTML clipboard format wraps the actual HTML fragment in metadata
 * headers and StartFragment/EndFragment comments. This strips the envelope,
 * returning only the HTML content between the fragment markers.
 */
function stripCfHtml(raw: string): string {
    const startMark = '<!--StartFragment-->';
    const endMark = '<!--EndFragment-->';
    const startIndex = raw.indexOf(startMark);
    const endIndex = raw.indexOf(endMark);
    if (startIndex !== -1 && endIndex !== -1) {
        return raw.slice(startIndex + startMark.length, endIndex);
    }
    return raw;
}

function buildConverter(): TurndownService {
    const td = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        fence: '```',
        emDelimiter: '_',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        linkReferenceStyle: 'full',
    });

    // GFM plugin: tables, task lists, strikethrough
    td.use(gfm);

    // Override the default fenced code block rule to preserve language annotations.
    // Claude Code's webview emits: <pre><code class="language-typescript">...</code></pre>
    // Turndown's built-in rule drops the language class. This rule extracts it.
    td.addRule('fencedCodeBlockWithLanguage', {
        filter: (node: HTMLElement): boolean => {
            const firstChild = node.firstChild as HTMLElement | null;
            return (
                node.nodeName === 'PRE' &&
                firstChild !== null &&
                firstChild.nodeName === 'CODE'
            );
        },
        replacement: (_content: string, node: HTMLElement): string => {
            const codeElement = node.firstChild as HTMLElement;

            // Extract language from class="language-typescript" pattern
            const className = codeElement.getAttribute?.('class') ?? '';
            const langMatch = className.match(/language-(\S+)/);
            const lang = langMatch ? langMatch[1] : '';

            // Use textContent to get raw code without HTML escaping artifacts
            const text = codeElement.textContent ?? '';

            return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
        },
    });

    // Strip wrapper elements that clipboard HTML may include but that aren't content
    td.remove(['style', 'script']);

    return td;
}

// Build once and reuse. TurndownService construction involves compiling rule
// filters, so a singleton avoids redundant work across multiple invocations.
const converter = buildConverter();

/**
 * Converts an HTML string to GitHub-Flavored Markdown.
 *
 * Handles Claude Code's specific HTML output (react-markdown / marked renderer),
 * Windows CF_HTML clipboard format, and standard browser-copied HTML.
 */
export function htmlToGfm(html: string): string {
    const cleaned = stripCfHtml(html);
    return converter.turndown(cleaned).trim();
}
