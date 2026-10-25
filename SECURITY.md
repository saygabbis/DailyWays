# Segurança — DailyWays

Este documento resume a postura de segurança da aplicação e o que **tu** deves verificar no Supabase e no hosting. O código no browser **não** pode impedir que alguém abra as DevTools ou altere o estado local: a proteção dos dados é **Row Level Security (RLS)** e **Auth** no Supabase.

## O que o repositório já faz (defesa em profundidade)

| Medida | Onde |
|--------|------|
| Remoção de `console.log` / `debug` / `info` / `trace` e `debugger` no build de produção | [`vite.config.js`](vite.config.js) — `@rollup/plugin-strip` (mantém `console.warn` e `console.error`) |
| Cabeçalhos HTTP (CSP, anti-clickjacking, etc.) | [`public/_headers`](public/_headers) — fonte única: o `vite preview` (VPS) envia esses cabeçalhos (CSP **aplicada**; `DW_CSP_REPORT_ONLY=1` volta ao modo aviso), e Netlify & cia leem o arquivo direto |
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

A CSP incluída em `_headers` permite:

- `connect-src`: o próprio site (inclui o `/socket.io` do collab), `https://*.supabase.co`, `wss://*.supabase.co` e o Google Fonts (`fonts.googleapis.com`/`fonts.gstatic.com`: o "Exportar como PNG" do Space baixa a fonte para embutir na imagem). O `vite preview` acrescenta sozinho a origem de `VITE_SUPABASE_URL` e `VITE_COLLAB_SERVER_URL` do `.env`;
- `style-src`/`font-src`: Google Fonts;
- `media-src`: streams https do Rádio e o som do Pomodoro;
- `img-src`: qualquer https (fotos de perfil do Google, URLs assinadas do Storage).

O login social é navegação (redirect), não passa pela CSP. Resultado do teste de segurança: [docs/SEGURANCA-2026-10.md](docs/SEGURANCA-2026-10.md).

## Nginx (exemplo)

Se servires a pasta `dist/` com Nginx, podes espelhar os mesmos cabeçalhos:

```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
# Ajustar a linha CSP à tua necessidade (OAuth, collab em subdomínio, etc.)
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://SEU_DOMINIO; frame-ancestors 'none'; base-uri 'self'; object-src 'none'" always;
```

Collab na mesma origem (`VITE_COLLAB_SERVER_URL=auto`): `connect-src 'self'` já cobre `wss://` do teu domínio. Configuração completa do proxy: `deploy/nginx-dailyways.example.conf`.

## Reportar problemas

Se descobrires uma vulnerabilidade, contacta o maintainer do projeto de forma privada antes de divulgar publicamente.
