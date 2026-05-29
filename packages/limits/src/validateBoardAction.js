import { TEXT } from './textLimits.js';
import { COUNT } from './countLimits.js';
import { LIMIT_ERROR } from './errorCodes.js';

function findCard(board, listId, cardId) {
  const list = board?.lists?.find((l) => l.id === listId);
  if (!list) return { list: null, card: null };
  const card = list.cards?.find((c) => c.id === cardId) ?? null;
  return { list, card };
}

function countLimit(field) {
  return { code: LIMIT_ERROR.COUNT_LIMIT, field };
}

function textLimit(field) {
  return { code: LIMIT_ERROR.TEXT_TOO_LONG, field, max: TEXT[field] ?? TEXT.cardTitle };
}

/**
 * @returns {{ code: string, field?: string, max?: number } | null}
 */
export function validateBoardActionLimits(board, action) {
  if (!board || !action?.type) return null;
  const p = action.payload || {};

  switch (action.type) {
    case 'ADD_LIST':
      if ((board.lists?.length ?? 0) >= COUNT.listsPerBoard) return countLimit('lists');
      if (p.title != null && String(p.title).length > TEXT.listTitle) {
        return { code: LIMIT_ERROR.TEXT_TOO_LONG, field: 'listTitle', max: TEXT.listTitle };
      }
      break;
    case 'ADD_CARD': {
      const list = board.lists?.find((l) => l.id === p.listId);
      if (list && (list.cards?.length ?? 0) >= COUNT.cardsPerList) return countLimit('cards');
      if (p.title != null && String(p.title).length > TEXT.cardTitle) {
        return { code: LIMIT_ERROR.TEXT_TOO_LONG, field: 'cardTitle', max: TEXT.cardTitle };
      }
      break;
    }
    case 'UPDATE_LIST': {
      const title = p.updates?.title;
      if (title != null && String(title).length > TEXT.listTitle) {
        return { code: LIMIT_ERROR.TEXT_TOO_LONG, field: 'listTitle', max: TEXT.listTitle };
      }
      break;
    }
    case 'UPDATE_CARD': {
      const title = p.updates?.title;
      if (title != null && String(title).length > TEXT.cardTitle) {
        return { code: LIMIT_ERROR.TEXT_TOO_LONG, field: 'cardTitle', max: TEXT.cardTitle };
      }
      const desc = p.updates?.description;
      if (desc != null && String(desc).length > TEXT.cardDescription) {
        return { code: LIMIT_ERROR.TEXT_TOO_LONG, field: 'description', max: TEXT.cardDescription };
      }
      const labels = p.updates?.labels;
      if (labels != null && labels.length > COUNT.labelsPerCard) return countLimit('labelsCard');
      break;
    }
    case 'UPDATE_BOARD': {
      const title = p.updates?.title;
      if (title != null && String(title).length > TEXT.boardTitle) {
        return { code: LIMIT_ERROR.TEXT_TOO_LONG, field: 'boardTitle', max: TEXT.boardTitle };
      }
      break;
    }
    case 'ADD_SUBTASK': {
      const { card } = findCard(board, p.listId, p.cardId);
      if (card && (card.subtasks?.length ?? 0) >= COUNT.subtasksPerCard) return countLimit('subtasks');
      if (p.title != null && String(p.title).length > TEXT.subtaskTitle) {
        return { code: LIMIT_ERROR.TEXT_TOO_LONG, field: 'subtaskTitle', max: TEXT.subtaskTitle };
      }
      break;
    }
    case 'UPDATE_SUBTASK': {
      const title = p.updates?.title;
      if (title != null && String(title).length > TEXT.subtaskTitle) {
        return { code: LIMIT_ERROR.TEXT_TOO_LONG, field: 'subtaskTitle', max: TEXT.subtaskTitle };
      }
      break;
    }
    default:
      break;
  }
  return null;
}

export function validateWhiteboardNodeCount(currentCount, adding = 1) {
  if (currentCount + adding > COUNT.whiteboardNodesPerSpace) return countLimit('nodes');
  return null;
}
