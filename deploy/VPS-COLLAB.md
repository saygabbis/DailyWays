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

## 3. Collab-server na VPS

```bash
cd /caminho/DailyWays/server/collab-server
# .env:
#   PORT=2529
#   NODE_ENV=production
#   SUPABASE_URL=...
#   SUPABASE_SERVICE_ROLE_KEY=...
#   CORS_ORIGIN=https://dailyways.saygabbis.cloud

npm install
npm run start
# ou PM2: pm2 start npm --name dailyways-collab -- run start
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
