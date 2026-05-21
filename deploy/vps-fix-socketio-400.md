# Corrigir Socket.IO HTTP 400 na VPS

Sintoma no browser: handshake com `sid`, depois `POST .../socket.io/...&sid=...` → **400** e `[collab] connect error xhr post error`.

## Causa #1 (confirmada em produção): CORS do collab

Se o **Response** do POST 400 for `{"code":3,"message":"Bad request"}`, o nginx está ok — falta o domínio em `CORS_ORIGIN`.

No `server/collab-server/.env` da VPS:

```env
CORS_ORIGIN=https://dailyways.saygabbis.cloud,http://31.97.90.13:5174,http://localhost:5174
NODE_ENV=production
```

Depois: `pm2 restart dailyways-collab` (ou reinicie o processo manual).

Teste rápido na VPS:

```bash
bash scripts/vps-diagnose.sh
# seção 6 deve mostrar HTTP 200, não 400
```

## Causa #2: nginx (se Response for `Session ID unknown`)

Nginx com `proxy_set_header Connection "upgrade";` **fixo** no `location /socket.io/`. Isso quebra o **long-polling POST**.

## Checklist na VPS (rode na ordem)

### 1. Collab rodando (UM processo só)

```bash
curl -s http://127.0.0.1:2529/health
# → {"ok":true,"service":"dailyways-collab"}

ss -tlnp | grep 2529
pm2 list
# Só um dailyways-collab (ou um node na 2529)
```

Se falhar: `cd ~/Bots/DailyWays && npm run start:collab` ou `pm2 start ecosystem.config.cjs --only dailyways-collab`

### 2. Arquivo `map` (obrigatório, uma vez)

```bash
sudo cat /etc/nginx/conf.d/connection-upgrade.conf
```

Tem que existir e conter:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

Se não existir:

```bash
sudo nano /etc/nginx/conf.d/connection-upgrade.conf
# cole o bloco acima, salve
```

### 3. Site dailyways — bloco `/socket.io/`

```bash
sudo nano /etc/nginx/sites-available/dailyways.saygabbis.cloud
```

**ERRADO (causa 400):**

```nginx
proxy_set_header Connection "upgrade";
```

**CERTO:**

```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:2529;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

### 4. Aplicar

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Teste externo

```bash
curl -s "https://dailyways.saygabbis.cloud/socket.io/?EIO=4&transport=polling" | head -c 120
```

Deve começar com `0{"sid":`

### 6. Browser

F12 → Network → filtro `socket.io` → o POST com `sid` deve ser **200**, não 400.

No **Response** do POST 400:

- `{"code":1,"message":"Session ID unknown"}` → quase sempre **dois processos collab** na mesma porta (PM2 + manual) ou nginx quebrando a sessão entre GET e POST.
- HTML do nginx → proxy errado ou collab offline.

Console: `[collab] connected` (e `responseSnippet` vazio no connect error).

### 7. Diagnóstico automático

```bash
cd ~/Bots/DailyWays && bash scripts/vps-diagnose.sh
pm2 logs dailyways-collab --lines 30
```

## CORS no collab `.env`

```env
CORS_ORIGIN=https://dailyways.saygabbis.cloud,http://31.97.90.13:5174
NODE_ENV=production
PORT=2529
```

Reiniciar collab após mudar: `pm2 restart dailyways-collab`

## Ignorar no console

- `ERR_BLOCKED_BY_CLIENT` (Google Analytics / adblock)
- `chrome-extension` / `content-script`
- `React DevTools` (Vite em modo dev na VPS)

## Arquivo completo de referência

`deploy/nginx-dailyways-full.example.conf`
