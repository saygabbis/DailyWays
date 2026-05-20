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

## Produção

Deploy em Railway/Fly/Render com variáveis do `.env.example`. Defina `VITE_COLLAB_SERVER_URL` no Vercel apontando para o host público do collab-server e adicione `wss://seu-collab-host` ao `connect-src` do CSP em `vercel.json`.
