import { uploadSpaceAsset, insertNode } from '../../../../services/whiteboardService';
import { getDefaultNodePayload } from '../nodeDefaults.js';
import { buildImageNodePayload, topLeftFromAnchor, formatFileSizeBytes } from '../creation/imageNodePayload.js';
import { findContainerAt } from '../../interaction/viewport/viewportUtils';
import { pushNodesAddBatch } from '../history/whiteboardHistory';
import { filterNodesByPage } from '../pages/whiteboardPages';
import { buildNodesById, nodeToWorld } from './whiteboardNodeOps';

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const WWW_PATTERN = /^www\.[^\s]+$/i;
const CLIPBOARD_TEXT_SKIP = new Set(['text/plain', 'text/html', 'text/uri-list']);

export function normalizeClipboardUrl(text) {
    const raw = text?.trim();
    if (!raw) return null;
    if (URL_PATTERN.test(raw)) return raw;
    if (WWW_PATTERN.test(raw)) return `https://${raw}`;
    try {
        const u = new URL(raw);
        if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
    } catch {
        /* ignore */
    }
    return null;
}

function estimateTextNodeSize(text) {
    const width = 200;
    const fontSize = 16;
    const lineHeight = 1.35;
    const charsPerLine = Math.max(12, Math.floor(width / (fontSize * 0.55)));
    const lines = String(text)
        .split('\n')
        .reduce((sum, line) => sum + Math.max(1, Math.ceil(Math.max(line.length, 1) / charsPerLine)), 0);
    const height = Math.max(40, Math.ceil(lines * fontSize * lineHeight) + 8);
    return { width, height };
}

function collectFilesFromDataTransfer(clipboardData) {
    const files = [];
    if (!clipboardData) return files;
    if (clipboardData.files?.length) {
        for (let i = 0; i < clipboardData.files.length; i += 1) {
            if (clipboardData.files[i]) files.push(clipboardData.files[i]);
        }
    }
    if (clipboardData.items) {
        for (let i = 0; i < clipboardData.items.length; i += 1) {
            const item = clipboardData.items[i];
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }
    }
    return files;
}

function resolveFilePayload(files) {
    if (!files.length) return null;
    const image = files.find((f) => f.type?.startsWith('image/'));
    if (image) return { kind: 'image', file: image };
    return { kind: 'file', file: files[0] };
}

async function dataUrlToFile(dataUrl) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    return new File([blob], `pasted-${Date.now()}.png`, { type: blob.type });
}

async function imageFileFromHtml(html) {
    if (!html) return null;
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (!match?.[1]) return null;
    const src = match[1];
    if (src.startsWith('data:image/')) {
        try {
            return await dataUrlToFile(src);
        } catch {
            return null;
        }
    }
    return null;
}

async function resolveFromClipboardItems(items) {
    if (!items?.length) return null;

    for (const item of items) {
        const imageType = item.types?.find((t) => t.startsWith('image/'));
        if (!imageType) continue;
        try {
            const blob = await item.getType(imageType);
            return {
                kind: 'image',
                file: new File([blob], `pasted-${Date.now()}.png`, { type: blob.type || imageType }),
            };
        } catch {
            /* try next */
        }
    }

    for (const item of items) {
        const fileType = item.types?.find(
            (t) => !CLIPBOARD_TEXT_SKIP.has(t) && !t.startsWith('text/')
        );
        if (!fileType) continue;
        try {
            const blob = await item.getType(fileType);
            const ext = fileType.split('/').pop() || 'bin';
            const name = `pasted-${Date.now()}.${ext}`;
            const file = new File([blob], name, { type: blob.type || fileType });
            if (file.type?.startsWith('image/')) return { kind: 'image', file };
            return { kind: 'file', file };
        } catch {
            /* try next */
        }
    }

    return null;
}

async function readClipboardText(clipboardData) {
    const fromEvent = clipboardData?.getData?.('text/plain')?.trim() ?? '';
    if (fromEvent) return fromEvent;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        try {
            return (await navigator.clipboard.readText())?.trim() ?? '';
        } catch {
            /* ignore */
        }
    }
    return '';
}

/**
 * Classifica o conteúdo colado: imagem | arquivo | link | texto | nós internos.
 */
export async function resolveClipboardPayload(clipboardData = null, internalNodes = null) {
    const fromFiles = resolveFilePayload(collectFilesFromDataTransfer(clipboardData));
    if (fromFiles) return fromFiles;

    if (clipboardData) {
        const html = clipboardData.getData?.('text/html');
        const imageFromHtml = await imageFileFromHtml(html);
        if (imageFromHtml) return { kind: 'image', file: imageFromHtml };
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.read) {
        try {
            const items = await navigator.clipboard.read();
            const fromItems = await resolveFromClipboardItems(items);
            if (fromItems) return fromItems;
        } catch {
            /* permissão ou contexto inseguro */
        }
    }

    const text = await readClipboardText(clipboardData);
    if (text) {
        const url = normalizeClipboardUrl(text);
        if (url) return { kind: 'link', url };
        return { kind: 'text', text };
    }

    if (internalNodes?.length) {
        return { kind: 'nodes' };
    }

    return null;
}

async function assignParentAndPage(payload, ctx) {
    const state = ctx.store.getState();
    const pageId = state.activePageId;
    payload.data = { ...(payload.data || {}), pageId };

    const pageNodes = filterNodesByPage(state.nodes, pageId);
    const byId = buildNodesById(pageNodes);
    const centerX = payload.x + (payload.width ?? 0) / 2;
    const centerY = payload.y + (payload.height ?? 0) / 2;
    const container = findContainerAt(pageNodes, centerX, centerY);
    if (container) {
        const containerWorld = nodeToWorld(container, byId);
        payload.parentId = container.id;
        payload.x = payload.x - containerWorld.x;
        payload.y = payload.y - containerWorld.y;
    }
    return payload;
}

async function persistNode(payload, ctx) {
    const { spaceId, userId, collabCreateNode, collabConnected, store } = ctx;
    if (collabConnected) {
        collabCreateNode({ ...payload, createdBy: userId ?? null });
    } else {
        const res = await insertNode(spaceId, payload, userId);
        if (!res.success) return null;
        store.getState().addNode(payload);
    }
    pushNodesAddBatch(store, [payload]);
    return payload.id;
}

function buildLinkPayload(url, placement) {
    const payload = getDefaultNodePayload('link', 0, 0);
    let title = url;
    try {
        title = new URL(url).hostname.replace(/^www\./, '');
    } catch {
        /* keep full url */
    }
    const { x, y } = topLeftFromAnchor(placement, payload.width, payload.height, placement.anchor ?? 'center');
    payload.x = x;
    payload.y = y;
    payload.data = { ...(payload.data || {}), url, title };
    return payload;
}

function buildTextPayload(text, placement) {
    const { width, height } = estimateTextNodeSize(text);
    const { x, y } = topLeftFromAnchor(placement, width, height, placement.anchor ?? 'center');
    const payload = getDefaultNodePayload('text', x, y);
    payload.width = width;
    payload.height = height;
    payload.data = { ...(payload.data || {}), text };
    return payload;
}

function buildFilePayload(file, url, placement) {
    const offsetX = 110;
    const offsetY = 40;
    const place =
        placement.anchor === 'topleft'
            ? placement
            : { x: placement.x - offsetX, y: placement.y - offsetY, anchor: 'topleft' };
    const payload = getDefaultNodePayload('file', place.x, place.y);
    payload.data = {
        ...(payload.data || {}),
        url,
        filename: file.name,
        size: formatFileSizeBytes(file.size),
    };
    return payload;
}

/**
 * Cola conforme o tipo detectado. Retorna true se tratou o paste.
 */
export async function pasteClipboardContent(ctx, placement, clipboardData, pasteInternalFn) {
    const { spaceId } = ctx;
    if (!spaceId) return false;

    const internalNodes = ctx.store.getState().clipboardNodes;
    const resolved = await resolveClipboardPayload(clipboardData, internalNodes);
    if (!resolved) return false;

    if (resolved.kind === 'nodes') {
        await pasteInternalFn();
        return true;
    }

    let payload;
    if (resolved.kind === 'image' || resolved.kind === 'file') {
        const result = await uploadSpaceAsset(spaceId, resolved.file, ctx.userId);
        if (!result?.url) return false;
        payload =
            resolved.kind === 'image'
                ? await buildImageNodePayload(resolved.file, result.url, placement)
                : buildFilePayload(resolved.file, result.url, placement);
    } else if (resolved.kind === 'link') {
        payload = buildLinkPayload(resolved.url, placement);
    } else {
        payload = buildTextPayload(resolved.text, placement);
    }

    await assignParentAndPage(payload, ctx);
    const id = await persistNode(payload, ctx);
    if (!id) return false;
    ctx.store.getState().setSelection([id]);
    return true;
}
