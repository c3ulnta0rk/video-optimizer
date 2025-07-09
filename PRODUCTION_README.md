# 🎬 Video Optimizer - Production

## 📦 Génération de l'AppImage

### Prérequis

Assurez-vous d'avoir installé les dépendances suivantes sur votre système Linux :

```bash
# FFmpeg (requis pour la conversion vidéo)
sudo apt update
sudo apt install ffmpeg

# Rust et Cargo (pour la compilation)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Node.js et npm (pour Angular)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Bun (pour la gestion des dépendances)
curl -fsSL https://bun.sh/install | bash
```

### 🚀 Construction de l'AppImage

#### Méthode 1 : Script automatisé (recommandé)

```bash
# Rendre le script exécutable (si pas déjà fait)
chmod +x build-appimage.sh

# Lancer la construction
./build-appimage.sh
```

#### Méthode 2 : Commande manuelle

```bash
# 1. Construire l'application Angular en mode production
npm run build:prod

# 2. Construire l'AppImage avec Tauri
npm run tauri build -- --target appimage
```

### 📁 Fichiers générés

Après la construction réussie, vous trouverez :

- **AppImage** : `./Video-Optimizer.AppImage`
- **Fichiers de build** : `src-tauri/target/release/bundle/appimage/`

### 🧪 Test de l'AppImage

```bash
# Rendre l'AppImage exécutable
chmod +x Video-Optimizer.AppImage

# Lancer l'application
./Video-Optimizer.AppImage
```

## 📋 Fonctionnalités de l'AppImage

### ✅ Fonctionnalités incluses

- **Conversion vidéo** : Support de multiples formats (MP4, MKV, AVI, MOV)
- **Codecs** : H.264, H.265, VP9
- **Qualités** : 4K, 1080p, 720p, 480p
- **Audio** : AAC, AC3, MP3, Opus
- **Sous-titres** : Copie sans conversion
- **Interface** : Moderne et intuitive
- **Paramètres** : Sauvegarde automatique

### 🔧 Configuration requise

- **Système** : Linux (Ubuntu 20.04+, Debian 11+, etc.)
- **FFmpeg** : Version 6+ (inclus dans l'AppImage)
- **Mémoire** : 2GB RAM minimum
- **Espace** : 500MB libre pour les conversions

## 🚀 Distribution

### Partage de l'AppImage

1. **Téléchargement direct** : Partagez le fichier `Video-Optimizer.AppImage`
2. **Installation** : Les utilisateurs peuvent l'exécuter directement
3. **Portabilité** : Fonctionne sur la plupart des distributions Linux

### Instructions pour les utilisateurs

```bash
# 1. Télécharger l'AppImage
# 2. Rendre exécutable
chmod +x Video-Optimizer.AppImage

# 3. Lancer l'application
./Video-Optimizer.AppImage
```

## 🔍 Dépannage

### Problèmes courants

#### L'AppImage ne se lance pas

```bash
# Vérifier les permissions
chmod +x Video-Optimizer.AppImage

# Vérifier les dépendances système
ldd Video-Optimizer.AppImage

# Lancer en mode debug
./Video-Optimizer.AppImage --debug
```

#### Erreur FFmpeg

```bash
# Vérifier que FFmpeg est installé
ffmpeg -version

# Installer FFmpeg si nécessaire
sudo apt install ffmpeg
```

#### Problèmes de performance

- Fermez les autres applications gourmandes
- Vérifiez l'espace disque disponible
- Utilisez des paramètres de conversion moins exigeants

## 📊 Optimisations de production

### Build optimisé

- **Angular** : Mode production avec minification
- **Tauri** : Build release optimisé
- **AppImage** : Taille réduite (~50-100MB)

### Sécurité

- **Sandboxing** : Isolation de l'application
- **Permissions** : Accès limité au système
- **Validation** : Vérification des entrées utilisateur

## 🎯 Prochaines étapes

### Améliorations possibles

1. **Auto-update** : Système de mise à jour automatique
2. **Batch processing** : Conversion de plusieurs fichiers
3. **Profils prédéfinis** : Configurations optimisées
4. **Plugins** : Support d'extensions
5. **Cloud integration** : Sauvegarde dans le cloud

### Support

Pour toute question ou problème :

- **Issues** : Créez une issue sur GitHub
- **Documentation** : Consultez le README principal
- **Community** : Rejoignez notre communauté

---

**Version** : 0.1.0  
**Date** : $(date)  
**Plateforme** : Linux (AppImage)
