import { describe, expect, it } from 'vitest';
import { normalizeHttpUrl, safeHref } from '../utils/safeUrl.js';

describe('safeUrl', () => {
  it('normaliza endereços comuns e recusa esquemas perigosos', () => {
    expect(normalizeHttpUrl('https://a.com/x')).toBe('https://a.com/x');
    expect(normalizeHttpUrl(' site.com.br/abc ')).toBe('https://site.com.br/abc');
    expect(normalizeHttpUrl('javascript:alert(1)')).toBe(null);
    expect(normalizeHttpUrl('JaVaScRiPt:alert(1)')).toBe(null);
    expect(normalizeHttpUrl('data:text/html,<script>')).toBe(null);
    expect(normalizeHttpUrl('não é link')).toBe(null);
    expect(normalizeHttpUrl('')).toBe(null);
  });

  it('safeHref só deixa http(s) virar link', () => {
    expect(safeHref('http://ok.com')).toBe('http://ok.com');
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref(' javascript:alert(1)')).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
  });
});

describe('uploads: tipos que o navegador executaria ficam de fora', () => {
  it('recusa HTML/JS/executáveis em anexos e arquivos do Space; aceita PDF e imagem', async () => {
    const { validateFile } = await import('@dailyways/limits');
    const file = (name, type, size = 10) => ({ name, type, size });
    expect(validateFile(file('pagina.html', 'text/html'), 'whiteboardFile').ok).toBe(false);
    expect(validateFile(file('x.js', ''), 'cardAttachment').ok).toBe(false);
    expect(validateFile(file('setup.exe', 'application/octet-stream'), 'whiteboardFile').ok).toBe(false);
    expect(validateFile(file('doc.pdf', 'application/pdf'), 'whiteboardFile').ok).toBe(true);
    expect(validateFile(file('foto.png', 'image/png'), 'chatImage').ok).toBe(true);
  });
});
