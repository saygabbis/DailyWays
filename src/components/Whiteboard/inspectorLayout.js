/** Largura do inspetor direito (painel Camadas/Design) para inset dos controles flutuantes. */
export const INSPECTOR_WIDTH_OPEN = 260;
export const INSPECTOR_WIDTH_COLLAPSED = 44;

export function getInspectorInsetPx(inspectorPanelOpen) {
    return inspectorPanelOpen ? INSPECTOR_WIDTH_OPEN : INSPECTOR_WIDTH_COLLAPSED;
}
