import { getToolMenuConfig } from '../../panels/toolbar/toolMenuRegistry.js';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore.js';

export function getToolVariant(toolId) {
    const config = getToolMenuConfig(toolId);
    if (!config) return null;
    const stored = useWhiteboardSelectionStore.getState().toolVariants?.[toolId];
    return stored ?? config.defaultVariant;
}

export function applyToolVariantToPayload(toolId, payload, variantId) {
    const config = getToolMenuConfig(toolId);
    if (!config?.applyVariant) return payload;
    const resolved = variantId ?? getToolVariant(toolId) ?? config.defaultVariant;
    return config.applyVariant(payload, resolved);
}
