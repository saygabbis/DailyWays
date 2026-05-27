import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createOpIdTracker } from './opIdTracker.js';

describe('createOpIdTracker', () => {
  it('deduplica opIds repetidos', () => {
    const t = createOpIdTracker(3);
    t.add('a');
    t.add('a');
    assert.equal(t.size, 1);
    assert.ok(t.has('a'));
  });

  it('descarta só o mais antigo ao encher — mantém recentes', () => {
    const t = createOpIdTracker(3);
    t.add('1');
    t.add('2');
    t.add('3');
    t.add('4');
    assert.ok(!t.has('1'));
    assert.ok(t.has('2'));
    assert.ok(t.has('3'));
    assert.ok(t.has('4'));
  });
});
