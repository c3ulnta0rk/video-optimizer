#!/bin/bash

# Script pour construire l'AppImage de Video Optimizer
# Usage: ./build-appimage.sh

set -e

echo "🎬 Construction de l'AppImage Video Optimizer..."
echo "================================================"

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis la racine du projet"
    exit 1
fi

# Nettoyer les builds précédents
echo "🧹 Nettoyage des builds précédents..."
rm -rf dist/
rm -rf src-tauri/target/

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

# Construire l'application Angular en mode production
echo "🔨 Construction de l'application Angular (production)..."
npm run build:prod

# Vérifier que le build Angular a réussi
if [ ! -d "dist/video/browser" ]; then
    echo "❌ Erreur: Le build Angular a échoué"
    exit 1
fi

echo "✅ Build Angular réussi"

# Construire l'AppImage avec Tauri
echo "🚀 Construction de l'AppImage avec Tauri..."
npm run tauri build

# Vérifier que l'AppImage a été créée
APPIMAGE_PATH=$(find src-tauri/target/release/bundle/appimage -name "*.AppImage" 2>/dev/null | head -1)

if [ -n "$APPIMAGE_PATH" ]; then
    echo "✅ AppImage créée avec succès!"
    echo "📁 Emplacement: $APPIMAGE_PATH"
    echo "📏 Taille: $(du -h "$APPIMAGE_PATH" | cut -f1)"
    
    # Copier l'AppImage dans le répertoire racine pour faciliter l'accès
    cp "$APPIMAGE_PATH" "./Video-Optimizer.AppImage"
    echo "📋 Copie: ./Video-Optimizer.AppImage"
    
    echo ""
    echo "🎉 Construction terminée avec succès!"
    echo "Vous pouvez maintenant distribuer l'AppImage: ./Video-Optimizer.AppImage"
else
    echo "❌ Erreur: L'AppImage n'a pas été créée"
    exit 1
fi 
