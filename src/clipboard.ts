import * as cp from 'child_process';

type Platform = 'linux-x11' | 'linux-wayland' | 'darwin' | 'win32';

function detectPlatform(): Platform {
    if (process.platform === 'darwin') {
        return 'darwin';
    }
    if (process.platform === 'win32') {
        return 'win32';
    }
    // On Linux, check for Wayland vs X11
    if (process.env.WAYLAND_DISPLAY) {
        return 'linux-wayland';
    }
    return 'linux-x11';
}

function execFile(command: string, args: readonly string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        cp.execFile(
            command,
            args as string[],
            {
                timeout: 5000,
                maxBuffer: 1024 * 1024,
            },
            (error, stdout, stderr) => {
                if (error) {
                    reject(
                        new Error(
                            `Command failed: ${command} ${args.join(' ')}\n${stderr || error.message}`
                        )
                    );
                    return;
                }
                resolve(stdout);
            }
        );
    });
}

/**
 * macOS `osascript` returns clipboard HTML as hex-encoded data wrapped in
 * `«data HTML48544d4c...»`. This decodes the hex payload to a UTF-8 string.
 * If the output is already plain HTML (newer macOS versions), it passes through.
 */
function decodeOsascriptHtml(raw: string): string {
    const match = raw.trim().match(/«data HTML([0-9a-fA-F]+)»/);
    if (!match) {
        return raw.trim();
    }
    return Buffer.from(match[1], 'hex').toString('utf8');
}

/**
 * Reads the `text/html` MIME type from the system clipboard using OS-native tools.
 *
 * Returns the HTML string, or `null` if the clipboard has no HTML content
 * (plain-text-only). Throws if the required clipboard tool is not installed.
 */
export async function readHtmlFromClipboard(): Promise<string | null> {
    const platform = detectPlatform();

    try {
        switch (platform) {
            case 'linux-x11':
                return await execFile('xclip', [
                    '-selection',
                    'clipboard',
                    '-t',
                    'text/html',
                    '-o',
                ]);

            case 'linux-wayland':
                return await execFile('wl-paste', ['--type', 'text/html']);

            case 'darwin': {
                const raw = await execFile('osascript', [
                    '-e',
                    'the clipboard as \u00ABclass HTML\u00BB',
                ]);
                return decodeOsascriptHtml(raw);
            }

            case 'win32':
                return await execFile('powershell.exe', [
                    '-NoProfile',
                    '-NonInteractive',
                    '-Command',
                    'Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetText("Html")',
                ]);
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);

        // These indicate the clipboard simply has no HTML content, not a real error.
        // xclip: "Error: target text/html not available"
        // wl-paste: exits non-zero when the requested type isn't present
        if (
            msg.includes('not available') ||
            msg.includes('No suitable type') ||
            msg.includes('no selection')
        ) {
            return null;
        }

        throw err;
    }
}
