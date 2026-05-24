import { Square, Circle, Hexagon } from 'lucide-react';

export const TOOL_VARIANT_MIME = 'application/x-whiteboard-tool-variant';

/**
 * Registo de ferramentas com submenu de variantes.
 * Adicionar novas entradas aqui — a toolbar e a criação consomem automaticamente.
 */
export const TOOL_MENU_REGISTRY = {
    shape: {
        toolId: 'shape',
        defaultVariant: 'rectangle',
        variants: [
            { id: 'rectangle', label: 'Quadrado', icon: Square },
            { id: 'ellipse', label: 'Círculo', icon: Circle },
            { id: 'polygon', label: 'Polígono', icon: Hexagon },
        ],
        applyVariant: (payload, variantId) => ({
            ...payload,
            data: {
                ...(payload.data || {}),
                shape: variantId,
                polygonSides: variantId === 'polygon' ? (payload.data?.polygonSides ?? 6) : undefined,
            },
        }),
        getActiveIcon: (variantId, variants) =>
            variants.find((v) => v.id === variantId)?.icon ?? Square,
    },
};

export function getToolMenuConfig(toolId) {
    return TOOL_MENU_REGISTRY[toolId] ?? null;
}

export function hasToolMenu(toolId) {
    return Boolean(TOOL_MENU_REGISTRY[toolId]);
}

export function getDefaultToolVariant(toolId) {
    return TOOL_MENU_REGISTRY[toolId]?.defaultVariant ?? null;
}
