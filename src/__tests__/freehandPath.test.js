import { describe, expect, it } from 'vitest';
import { buildFreehandNode, pointsToSmoothPath, simplifyPoints } from '../components/Whiteboard/core/creation/freehandPath.js';
import { thumbPathFor } from '../utils/imageOptimize.js';

describe('caneta (freehandPath)', () => {
  it('simplifica pontos colineares mantendo as pontas', () => {
    const line = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0 }));
    expect(simplifyPoints(line, 0.5)).toEqual([{ x: 0, y: 0 }, { x: 49, y: 0 }]);
  });

  it('mantém o canto de um "L"', () => {
    const pts = [...Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0 })), ...Array.from({ length: 10 }, (_, i) => ({ x: 9, y: i + 1 }))];
    const out = simplifyPoints(pts, 0.5);
    expect(out).toContainEqual({ x: 9, y: 0 });
    expect(out).toHaveLength(3);
  });

  it('gera curva suave com M/Q/L e ponto solto vira traço mínimo', () => {
    expect(pointsToSmoothPath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }])).toBe('M 0 0 Q 10 10 15 5 L 20 0');
    expect(pointsToSmoothPath([{ x: 5, y: 5 }])).toMatch(/^M 5 5 L 5\.01 5$/);
  });

  it('nó tem bounds com folga da espessura e caminho relativo à origem', () => {
    const node = buildFreehandNode([{ x: 100, y: 50 }, { x: 140, y: 90 }], { strokeWidth: 4, epsilon: 0.5 });
    expect(node.x).toBeCloseTo(98, 2);
    expect(node.y).toBeCloseTo(48, 2);
    expect(node.width).toBeCloseTo(44, 2);
    expect(node.height).toBeCloseTo(44, 2);
    expect(node.data.freehand).toBe(true);
    expect(node.data.paths[0].d.startsWith('M 2 2')).toBe(true);
  });

  it('caminho da miniatura fica ao lado do arquivo', () => {
    expect(thumbPathFor('s1/abc.png')).toBe('s1/abc.thumb.webp');
    expect(thumbPathFor('s1/abc')).toBe('s1/abc.thumb.webp');
  });
});
