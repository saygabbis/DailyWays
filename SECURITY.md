# Segurança — DailyWays

Este documento resume a postura de segurança da aplicação e o que **tu** deves verificar no Supabase e no hosting. O código no browser **não** pode impedir que alguém abra as DevTools ou altere o estado local: a proteção dos dados é **Row Level Security (RLS)** e **Auth** no Supabase.

## O que o repositório já faz (defesa em profundidade)

| Medida | Onde |
|--------|------|
| Remoção de `console.log` / `debug` / `info` / `trace` e `debugger` no build de produção | [`vite.config.js`](vite.config.js) — `@rollup/plugin-strip` (mantém `console.warn` e `console.error`) |
| Cabeçalhos HTTP (CSP, anti-clickjacking, etc.) | [`public/_headers`](public/_headers) (Netlify e similares), [`vercel.json`](vercel.json) (Vercel) |
| Chave anónima do Supabase no cliente | Esperado — **nunca** commits com `service_role` |

## Checklist Supabase (produção)

- [ ] Todas as migrações em `supabase/migrations/` aplicadas ao projeto de **produção** (não só local).
- [ ] **Authentication** → URL Configuration: redirect URLs e site URL corretos para o domínio real.
- [ ] **Rate limiting** e limites de pedidos conforme o teu plano (dashboard Supabase).
- [ ] Revisão periódica de **RLS** por tabela (nada de `USING (true)` sem necessidade).
- [ ] Funções `SECURITY DEFINER` e RPCs: confirmar quem pode executar e que não expõem dados a mais.
- [ ] **Storage**: políticas de buckets (avatars, etc.) alinhadas com o uso real.

## Dependências

```bash
npm audit
```

Correções automáticas quando seguras:

```bash
npm audit fix
```

Rever manualmente alterações que quebrem compatibilidade.

## Variáveis de ambiente

- Nunca commitar `.env.local` (já está no [`.gitignore`](.gitignore)).
- Em CI/CD, definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` como segredos do host, não no código.

## Content-Security-Policy (CSP)

A CSP incluída em `_headers` / `vercel.json` permite:

- `connect-src`: `https://*.supabase.co`, `wss://*.supabase.co` (API + Realtime).

Se ativares **login social** (Google, GitHub, etc.), tens de acrescentar os domínios de OAuth e callbacks em `connect-src` (e `frame-src` se necessário). Testa a app após qualquer alteração.

## Nginx (exemplo)

Se servires a pasta `dist/` com Nginx, podes espelhar os mesmos cabeçalhos:

```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
# Ajustar a linha CSP à tua necessidade (OAuth, etc.)
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in; frame-ancestors 'none'; base-uri 'self'; object-src 'none'" always;
```

## Reportar problemas

Se descobrires uma vulnerabilidade, contacta o maintainer do projeto de forma privada antes de divulgar publicamente.
