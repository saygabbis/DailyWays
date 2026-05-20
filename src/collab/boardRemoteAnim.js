/** Ephemeral remote collab animations (no React store — avoids board-wide re-renders). */

const cardIds = new Set();
const listIds = new Set();
const cardSubs = new Set();
const listSubs = new Set();

function notifyCard() {
  cardSubs.forEach((fn) => fn());
}

function notifyList() {
  listSubs.forEach((fn) => fn());
}

export function pulseRemoteCard(cardId) {
  if (!cardId) return;
  cardIds.add(cardId);
  notifyCard();
  setTimeout(() => {
    cardIds.delete(cardId);
    notifyCard();
  }, 700);
}

export function pulseRemoteList(listId) {
  if (!listId) return;
  listIds.add(listId);
  notifyList();
  setTimeout(() => {
    listIds.delete(listId);
    notifyList();
  }, 900);
}

export function isRemoteCardAnimating(cardId) {
  return cardIds.has(cardId);
}

export function isRemoteListAnimating(listId) {
  return listIds.has(listId);
}

export function subscribeRemoteCardAnim(cb) {
  cardSubs.add(cb);
  return () => cardSubs.delete(cb);
}

export function subscribeRemoteListAnim(cb) {
  listSubs.add(cb);
  return () => listSubs.delete(cb);
}

export function notifyRemoteBoardAction(action) {
  if (!action?.type) return;
  const p = action.payload || {};
  switch (action.type) {
    case 'MOVE_CARD':
      if (p.cardId) pulseRemoteCard(p.cardId);
      break;
    case 'ADD_CARD':
      if (p.cardData?.id) pulseRemoteCard(p.cardData.id);
      break;
    case 'MOVE_LIST':
      if (p.listId) pulseRemoteList(p.listId);
      break;
    default:
      break;
  }
}
