/** Qual board o socket está na sala collab (compartilhado entre mounts do BoardCollabSync). */
let globalJoinedBoardId = null;

export function getGlobalJoinedBoardId() {
  return globalJoinedBoardId;
}

export function setGlobalJoinedBoardId(boardId) {
  globalJoinedBoardId = boardId || null;
}

export function clearGlobalJoinedBoardId() {
  globalJoinedBoardId = null;
}
