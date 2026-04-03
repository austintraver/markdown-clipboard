import * as vscode from 'vscode';
import { readHtmlFromClipboard } from './clipboard';
import { htmlToGfm } from './convert';

/**
 * Polls `vscode.env.clipboard.readText()` until it returns a value different
 * from `beforeText`, indicating the OS clipboard was written by the copy action.
 * Returns immediately if the clipboard changes; gives up after `maxMs` and
 * proceeds regardless (the copy may have produced identical text, or may have
 * completed between our snapshot and the executeCommand call).
 */
async function waitForClipboardChange(beforeText: string, maxMs = 500): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
        await new Promise<void>(resolve => setTimeout(resolve, 10));
        const current = await vscode.env.clipboard.readText();
        if (current !== beforeText) {
            return;
        }
    }
}

async function copyAsMarkdown(): Promise<void> {
    // Snapshot current clipboard text so we can detect when the copy lands.
    const beforeText = await vscode.env.clipboard.readText();

    // Trigger the native copy in the currently focused element. When a webview
    // is focused, VSCode routes this to webview.copy() which calls
    // execCommand('copy') inside the iframe, placing both text/html and
    // text/plain on the OS clipboard.
    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');

    // The executeCommand promise resolves before the clipboard write completes
    // (the copy crosses Electron IPC boundaries). Poll until the clipboard
    // text changes, indicating the write has landed.
    await waitForClipboardChange(beforeText);

    let html: string | null;
    try {
        html = await readHtmlFromClipboard();
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);

        if (msg.includes('ENOENT') || msg.includes('spawn') || msg.includes('not found')) {
            const platform = process.platform;
            const hint =
                platform === 'darwin'
                    ? 'osascript should be available by default on macOS.'
                    : platform === 'win32'
                      ? 'PowerShell should be available by default on Windows.'
                      : 'Install xclip (X11): sudo apt install xclip — or wl-clipboard (Wayland): sudo apt install wl-clipboard';
            void vscode.window.showErrorMessage(
                `Copy as Markdown: clipboard tool not found. ${hint}`
            );
        } else {
            void vscode.window.showErrorMessage(
                `Copy as Markdown: failed to read clipboard HTML. ${msg}`
            );
        }
        return;
    }

    if (html === null) {
        const plainText = await vscode.env.clipboard.readText();
        if (!plainText.trim()) {
            void vscode.window.showInformationMessage(
                'Copy as Markdown: nothing selected.'
            );
        } else {
            void vscode.window.showInformationMessage(
                'Copy as Markdown: no HTML in clipboard, already plain text.'
            );
        }
        return;
    }

    let markdown: string;
    try {
        markdown = htmlToGfm(html);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(
            `Copy as Markdown: conversion failed. ${msg}`
        );
        return;
    }

    if (!markdown.trim()) {
        void vscode.window.showInformationMessage(
            'Copy as Markdown: converted content is empty.'
        );
        return;
    }

    await vscode.env.clipboard.writeText(markdown);
    void vscode.window.showInformationMessage('Copied as Markdown');
}

export function activate(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand(
        'markdownClipboard.copyAsMarkdown',
        copyAsMarkdown
    );
    context.subscriptions.push(disposable);
}

export function deactivate(): void {
    // No cleanup needed
}
