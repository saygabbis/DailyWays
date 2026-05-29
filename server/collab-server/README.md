# DailyWays Collab Server

Servidor WebSocket autoritativo (Socket.IO) para sincronização do whiteboard em tempo real.

## Desenvolvimento

```bash
# Na raiz do monorepo
npm install
cp server/collab-server/.env.example server/collab-server/.env
# Preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY

npm run dev:collab
```

Ou **um terminal só** (app + collab juntos):

```bash
npm run dev:all
```

O `.env` desta pasta é carregado automaticamente (`dotenv`). O cliente usa `VITE_COLLAB_SERVER_URL` (ex.: `http://localhost:2525`).

## Produção (VPS)

1. Rode o collab-server na VPS (`PORT=2529`, `NODE_ENV=production`).
2. No build do frontend: `VITE_COLLAB_SERVER_URL=auto` (mesmo domínio) **ou** URL pública do collab.
3. No **nginx**, faça proxy de `/socket.io/` para `127.0.0.1:2529` com upgrade WebSocket — veja `deploy/nginx-dailyways.example.conf`.
4. Em `CORS_ORIGIN`, inclua `https://seu-dominio.com` (sem barra no final).
5. Teste: `curl https://seu-dominio.com/socket.io/?EIO=4&transport=polling` deve retornar JSON com `"sid"`.
6. Teste health: `curl https://seu-dominio.com/collab-health` → `{"ok":true,...}` (se usar o location do exemplo).

Sem o proxy `/socket.io/` (ou sem o processo collab rodando), o app cai só em `persistBoard` (Supabase) — sem tempo real nem cursores.

Deploy alternativo (Railway/Fly): defina `VITE_COLLAB_SERVER_URL` para o host do collab e adicione `wss://` ao CSP.

## Segurança

- **Auth/RLS:** `canAccessSpace` / `canAccessBoard` e carga de space usam `SUPABASE_ANON_KEY` + JWT do usuário (RLS). A `SUPABASE_SERVICE_ROLE_KEY` é só para flush/persistência.
- **JWT:** validação apenas via JWKS local; tokens inválidos não chamam a API Auth do Supabase.
- **Rate limit:** por `userId` (ops) e limite de conexões simultâneas; falhas de auth por IP.
- **DEV prank:** desligado em `NODE_ENV=production` salvo `COLLAB_DEV_PRANK=1`. Allowlist: `COLLAB_DEV_USER_IDS` (UUIDs, vírgula).
- **CORS:** em produção só origens em `CORS_ORIGIN` (sem bypass LAN).
