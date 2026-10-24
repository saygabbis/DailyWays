import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from './roomManager.js';

function managerWithRoom(roomId) {
  const rm = new RoomManager();
  clearInterval(rm._gcTimer);
  rm.rooms.set(roomId, { kind: 'board', clientCount: 0, presence: new Map(), lastActivity: 0 });
  let flushes = 0;
  rm.flushNow = async () => { flushes += 1; };
  return { rm, room: rm.rooms.get(roomId), flushes: () => flushes };
}

test('contagem por socket é idempotente (join/leave repetidos não desbalanceiam)', async () => {
  const { rm, room, flushes } = managerWithRoom('board:1');
  rm.clientJoined('board:1', 'a');
  rm.clientJoined('board:1', 'a');
  rm.clientJoined('board:1', 'b');
  assert.equal(room.clientCount, 2);
  await rm.clientLeft('board:1', 'a');
  await rm.clientLeft('board:1', 'a');
  assert.equal(room.clientCount, 1);
  assert.equal(flushes(), 0, 'não descarrega com gente na sala');
  await rm.clientLeft('board:1', 'b');
  assert.equal(room.clientCount, 0);
  assert.equal(flushes(), 1);
});

test('sair sem ter entrado (rollback de join com erro) não mexe no contador', async () => {
  const { rm, room, flushes } = managerWithRoom('board:2');
  rm.clientJoined('board:2', 'a');
  await rm.clientLeft('board:2', 'zzz');
  assert.equal(room.clientCount, 1);
  assert.equal(flushes(), 0);
});
