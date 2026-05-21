#!/usr/bin/env bash
# Rode na VPS: bash scripts/vps-diagnose.sh
set -e
PORT="${COLLAB_PORT:-2529}"
DOMAIN="${COLLAB_DOMAIN:-dailyways.saygabbis.cloud}"

echo "=== 1. Collab health (127.0.0.1:${PORT}) ==="
if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null; then
  curl -s "http://127.0.0.1:${PORT}/health"
  echo ""
else
  echo "FALHA: collab não responde. Rode: npm run start:collab ou pm2 start ecosystem.config.cjs"
fi

echo ""
echo "=== 2. Processos na porta ${PORT} ==="
ss -tlnp 2>/dev/null | grep ":${PORT} " || echo "(nenhum listener)"

echo ""
echo "=== 3. Nginx map connection_upgrade ==="
if [ -f /etc/nginx/conf.d/connection-upgrade.conf ]; then
  grep -A3 'map \$http_upgrade' /etc/nginx/conf.d/connection-upgrade.conf || echo "arquivo existe mas sem map?"
else
  echo "FALTA: /etc/nginx/conf.d/connection-upgrade.conf"
fi

echo ""
echo "=== 4. Bloco socket.io no site ==="
SITE="/etc/nginx/sites-available/${DOMAIN}"
if [ -f "$SITE" ]; then
  if grep -q 'Connection "upgrade"' "$SITE" 2>/dev/null; then
    echo "PROBLEMA: ainda tem Connection \"upgrade\" fixo — troque por \$connection_upgrade"
    grep -n 'Connection' "$SITE" || true
  elif grep -q 'connection_upgrade' "$SITE"; then
    echo "OK: usa \$connection_upgrade"
  else
    echo "AVISO: não achei connection_upgrade no site — confira location /socket.io/"
  fi
else
  echo "Site não encontrado em $SITE"
fi

echo ""
echo "=== 5. Polling público ==="
if curl -sf "https://${DOMAIN}/socket.io/?EIO=4&transport=polling" >/dev/null 2>&1; then
  curl -s "https://${DOMAIN}/socket.io/?EIO=4&transport=polling" | head -c 80
  echo ""
else
  echo "FALHA: https://${DOMAIN}/socket.io/ não responde"
fi

echo ""
echo "=== Fim ==="
