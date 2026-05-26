const SKIP_TYPES = new Set(['UPDATE_BOARD']);

/** Regista no histórico; texto (título/descrição) é agrupado em boardHistoryCoalesce. */
export function shouldRecordBoardAction(action) {
    if (!action?.type || SKIP_TYPES.has(action.type)) return false;
    return true;
}
