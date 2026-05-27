import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBoardRoomState,
  getBoardRoomState,
  hasBoardPendingFlush,
} from '../board/boardRoomAdapter.js';
import {
  createSpaceRoomState,
  getSpaceRoomState,
  hasSpacePendingFlush,
} from '../space/spaceRoomAdapter.js';
import { getRoomRuntime, hasPendingFlush } from './roomRuntime.js';

describe('roomRuntime adapters', () => {
  it('resolve runtime by room kind', () => {
    const boardRuntime = getRoomRuntime('room:board:any', { kind: 'board' });
    const spaceRuntime = getRoomRuntime('room:space:any', { kind: 'space' });
    assert.equal(typeof boardRuntime.applyOp, 'function');
    assert.equal(typeof spaceRuntime.applyOp, 'function');
  });

  it('tracks pending flush for space and board', () => {
    const board = createBoardRoomState();
    const space = createSpaceRoomState();

    assert.equal(hasBoardPendingFlush(board), false);
    assert.equal(hasSpacePendingFlush(space), false);
    assert.equal(hasPendingFlush('room:board:test', board), false);
    assert.equal(hasPendingFlush('room:space:test', space), false);

    board.dirty = true;
    space.dirty.nodes.add('node-1');
    assert.equal(hasPendingFlush('room:board:test', board), true);
    assert.equal(hasPendingFlush('room:space:test', space), true);
  });

  it('returns normalized room state by adapter', () => {
    const board = createBoardRoomState();
    board.board = { id: 'b1', lists: [] };
    board.revision = 3;
    const boardState = getBoardRoomState(board);
    assert.equal(boardState.board.id, 'b1');
    assert.equal(boardState.revision, 3);

    const space = createSpaceRoomState();
    space.nodes.push({ id: 'n1' });
    const spaceState = getSpaceRoomState(space);
    assert.equal(spaceState.nodes.length, 1);
    assert.equal(spaceState.revision, 0);
  });
});
