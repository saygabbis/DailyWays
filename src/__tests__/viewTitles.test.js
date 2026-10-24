import { describe, expect, it } from 'vitest';
import { getViewTitle, getViewSubtitle } from '../app/viewTitles.js';

const board = { emoji: '🚀', title: 'B', lists: [{ cards: [1, 2] }, { cards: [3] }] };

describe('viewTitles', () => {
  it('views fixas, board e space', () => {
    expect(getViewTitle('myday')).toBe('Diário');
    expect(getViewTitle('board', board)).toBe('🚀 B');
    expect(getViewTitle('board', null)).toBe('Board');
    expect(getViewTitle('space-s1', null, [{ id: 's1', emoji: '🧪', title: 'S' }])).toBe('🧪 S');
    expect(getViewTitle('space-x', null, [])).toBe('Space');
    expect(getViewTitle('qualquer')).toBe('DailyWays');
  });
  it('subtítulos', () => {
    expect(getViewSubtitle('board', board)).toBe('2 listas · 3 tarefas');
    expect(getViewSubtitle('space-1')).toBe('Canvas Infinito');
    expect(getViewSubtitle('dashboard')).toBeNull();
  });
});
