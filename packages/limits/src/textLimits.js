/** Limites de texto (caracteres). */
export const TEXT = {
  cardTitle: 200,
  listTitle: 200,
  boardTitle: 120,
  spaceTitle: 120,
  subtaskTitle: 200,
  cardDescription: 16_000,
  cardComment: 4_000,
  chatMessage: 4_000,
  labelName: 40,
  profileName: 80,
  profileBio: 500,
  usernameMin: 2,
  usernameMax: 32,
  linkUrl: 2048,
  linkLabel: 120,
  whiteboardNodeText: 8_000,
  boardEmoji: 10,
  hoverModalEl: 64,
};

/** liveDraft (collab presence) — por campo. */
export const LIVE_DRAFT_MAX = {
  title: TEXT.cardTitle,
  description: TEXT.cardDescription,
  commentBody: TEXT.cardComment,
  priority: 32,
  startDate: 32,
  dueDate: 32,
  recurrenceRule: 512,
  cardColor: 32,
};
