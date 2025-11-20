#!/bin/bash

echo "⚠️  IMPORTANT: Lancez d'abord ngrok dans un autre terminal: ngrok http 3001"
echo "⚠️  Attendez que ngrok affiche l'URL HTTPS, puis continuez ici"
echo ""
read -p "Entrez l'URL ngrok complète (ex: https://xxxx.ngrok-free.app): " NGROK_URL

if [ -z "$NGROK_URL" ]; then
    echo "❌ URL ngrok vide, arrêt."
    exit 1
fi

echo ""
echo "🚀 Démarrage du serveur sur le port 3001 avec ngrok..."
echo "📡 URL ngrok: $NGROK_URL"
echo ""

PORT=3001 SHOPIFY_APP_URL="$NGROK_URL" shopify app dev --tunnel-url="$NGROK_URL"

