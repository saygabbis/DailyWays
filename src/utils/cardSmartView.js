import { isCardImportant } from './cardImportant';
import { parseCardDate } from './cardDateTime';

/** Tarefa concluída ou em lista de conclusão — não entra em Diário/Importante/Planejado nem nos badges. */
export function isCardActive(card) {
    if (!card) return false;
    if (card.completed) return false;
    if (card.isCompletionList) return false;
    return true;
}

export function isCardActiveImportant(card) {
    return isCardActive(card) && isCardImportant(card);
}

export function isCardActivePlanned(card) {
    return isCardActive(card) && Boolean(parseCardDate(card.dueDate) || parseCardDate(card.startDate));
}

export function isCardActiveMyDay(card) {
    return isCardActive(card) && Boolean(card.myDay);
}

export function enrichCardForSmartView(card, board, list) {
    return {
        ...card,
        boardId: board.id,
        listId: list.id,
        boardTitle: board.title,
        boardEmoji: board.emoji,
        listTitle: list.title,
        isCompletionList: list.isCompletionList ?? false,
    };
}
