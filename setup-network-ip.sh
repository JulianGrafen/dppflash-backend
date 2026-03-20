#!/bin/bash

# 🌐 Auto-Setup Script für Network IP
# Findet deine lokale IP und aktualisiert .env.local automatisch

set -e

echo "🔍 Erkenne Network IP..."

# Finde IPv4 Adresse
IP=$(ifconfig | grep -E "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

if [ -z "$IP" ]; then
  echo "❌ Fehler: Konnte Network IP nicht finden"
  echo "📝 Bitte manuell setzen:"
  echo "   NEXT_PUBLIC_DPP_URL=http://YOUR_IP:3000"
  exit 1
fi

echo "✅ Network IP gefunden: $IP"

# Erstelle/Update .env.local
ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "📄 Erstelle $ENV_FILE..."
  cp .env.example "$ENV_FILE"
else
  echo "📝 Aktualisiere vorhandene $ENV_FILE..."
fi

# Update NEXT_PUBLIC_DPP_URL
if grep -q "NEXT_PUBLIC_DPP_URL" "$ENV_FILE"; then
  # Ersetze bestehende URL
  sed -i '' "s|NEXT_PUBLIC_DPP_URL=.*|NEXT_PUBLIC_DPP_URL=http://$IP:3000|" "$ENV_FILE"
else
  # Füge neue Zeile am Anfang ein
  sed -i '' "1i\\
NEXT_PUBLIC_DPP_URL=http://$IP:3000\\
" "$ENV_FILE"
fi

echo "✨ .env.local aktualisiert:"
echo "   NEXT_PUBLIC_DPP_URL=http://$IP:3000"
echo ""
echo "🚀 Starte jetzt mit:"
echo "   npm run dev"
echo ""
echo "📱 Dann öffne in deinem Browser:"
echo "   http://$IP:3000/dashboard/create"
