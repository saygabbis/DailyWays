import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPresenceSyncPayload } from './presencePayload.js';

describe('createPresenceSyncPayload', () => {
  it('maps board room id to boardId', () => {
    const payload = createPresenceSyncPayload('board:abc-123', [{ userId: 'u1' }]);
    assert.equal(payload.roomId, 'board:abc-123');
    assert.equal(payload.boardId, 'abc-123');
    assert.equal(payload.spaceId, null);
    assert.equal(payload.peers.length, 1);
  });

  it('maps space room id to spaceId', () => {
    const payload = createPresenceSyncPayload('space:xyz-999', []);
    assert.equal(payload.roomId, 'space:xyz-999');
    assert.equal(payload.spaceId, 'xyz-999');
    assert.equal(payload.boardId, null);
  });
});
