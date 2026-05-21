# DailyWays na VPS — collab (WebSocket) + nginx

## 1. Ver teu nginx atual

Na VPS (SSH):

```bash
# Arquivo do site
sudo cat /etc/nginx/sites-enabled/dailyways.saygabbis.cloud
# ou
sudo cat /etc/nginx/conf.d/dailyways.conf
# ou lista tudo
sudo nginx -T 2>/dev/null | grep -A2 "server_name dailyways"
```

Copia e cola o bloco `server { ... }` inteiro (pode censurar paths de certificado).

## 2. O que precisa existir no nginx

Dentro do `server` do domínio **antes** do `location /`:

```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:2529;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

Exemplo completo: `deploy/nginx-dailyways.example.conf`

## 3. Dois processos na VPS (obrigatório)

O nginx manda `/` → **5174** (Vite) e `/socket.io/` → **2529** (collab).

Se só subir o Vite (`npm run dev`), o terminal mostra:

`ECONNREFUSED 127.0.0.1:2529` — **collab não está rodando**.

### Opção A — um comando (terminal aberto)

```bash
cd ~/Bots/DailyWays
npm install
npm run start:vps
```

Sobe collab + Vite juntos.

### Opção B — PM2 (recomendado, sobrevive ao logout)

```bash
cd ~/Bots/DailyWays
npm install
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

### Opção C — dois terminais

Terminal 1:

```bash
cd ~/Bots/DailyWays && npm run start:collab
```

Terminal 2:

```bash
cd ~/Bots/DailyWays && npm run dev -- --host
```

### `.env` do collab (`server/collab-server/.env`)

```env
PORT=2529
NODE_ENV=production
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CORS_ORIGIN=https://dailyways.saygabbis.cloud,http://31.97.90.13:5174
```

Teste na VPS:

```bash
curl http://127.0.0.1:2529/health
curl "https://dailyways.saygabbis.cloud/socket.io/?EIO=4&transport=polling"
```

## 4. Frontend (build)

Na raiz, `.env` de produção:

```env
VITE_COLLAB_SERVER_URL=auto
```

```bash
npm run build
# servir dist/ (ou proxy para Vite só em dev)
```

## 5. Aplicar nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Validar no browser

Console deve mostrar:

`[collab] connected { url: "https://dailyways.saygabbis.cloud", transport: "polling" }`

Sem `connect error` em loop.
