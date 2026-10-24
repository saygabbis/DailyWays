import { describe, expect, it } from 'vitest';
import ErrorBoundary from '../components/Common/ErrorBoundary.jsx';

describe('ErrorBoundary', () => {
  it('guarda o erro capturado', () => {
    const err = new Error('boom');
    expect(ErrorBoundary.getDerivedStateFromError(err)).toEqual({ error: err });
  });

  it('limpa o erro quando resetKey muda (ex.: troca de view)', () => {
    const state = { error: new Error('x'), resetKey: 'board:1' };
    expect(ErrorBoundary.getDerivedStateFromProps({ resetKey: 'myday:' }, state)).toEqual({ error: null, resetKey: 'myday:' });
    expect(ErrorBoundary.getDerivedStateFromProps({ resetKey: 'board:1' }, state)).toBeNull();
  });
});
