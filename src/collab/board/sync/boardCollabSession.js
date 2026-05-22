/** Qual board o socket está na sala collab (compartilhado entre mounts do BoardCollabSync). */
let globalJoinedBoardId = null;

/** Incrementa a cada mount/efeito do BoardCollabSync; invalida leaveRoom atrasado do cleanup. */
let boardCollabMountGen = 0;

export function getGlobalJoinedBoardId() {
  return globalJoinedBoardId;
}

export function setGlobalJoinedBoardId(boardId) {
  globalJoinedBoardId = boardId || null;
}

export function clearGlobalJoinedBoardId() {
  globalJoinedBoardId = null;
}

export function nextBoardCollabMountGen() {
  boardCollabMountGen += 1;
  return boardCollabMountGen;
}

export function getBoardCollabMountGen() {
  return boardCollabMountGen;
}
