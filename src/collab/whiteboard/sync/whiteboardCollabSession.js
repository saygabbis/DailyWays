let globalJoinedSpaceId = null;
let whiteboardCollabMountGen = 0;

export function getGlobalJoinedSpaceId() {
    return globalJoinedSpaceId;
}

export function setGlobalJoinedSpaceId(spaceId) {
    globalJoinedSpaceId = spaceId || null;
}

export function clearGlobalJoinedSpaceId() {
    globalJoinedSpaceId = null;
}

export function nextWhiteboardCollabMountGen() {
    whiteboardCollabMountGen += 1;
    return whiteboardCollabMountGen;
}

export function getWhiteboardCollabMountGen() {
    return whiteboardCollabMountGen;
}
