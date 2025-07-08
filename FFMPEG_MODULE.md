# 🎬 Module FFmpeg Formats - Documentation

## 📋 Vue d'ensemble

Ce module permet de vérifier et d'afficher tous les formats de sortie supportés par FFmpeg installé sur le système. Il fournit une interface moderne et intuitive pour explorer les capacités de conversion de FFmpeg.

## 🚀 Fonctionnalités

### ✅ Vérification automatique

- Détection de la disponibilité de FFmpeg
- Récupération de tous les formats supportés
- Gestion d'erreurs robuste

### 🎯 Interface utilisateur

- **Dialogue moderne** avec onglets organisés
- **Recherche en temps réel** des formats
- **Catégorisation intelligente** (courants, haute qualité, mobile)
- **Design responsive** pour tous les écrans

### 🔧 API complète

- Service injectable pour utilisation programmatique
- Méthodes de validation et de recherche
- Intégration facile dans l'application existante

## 📁 Structure des fichiers

```
src/
├── services/
│   └── ffmpeg-formats.service.ts          # Service principal
├── components/
│   ├── ffmpeg-formats-dialog/             # Dialogue principal
│   │   ├── ffmpeg-formats-dialog.component.ts
│   │   ├── ffmpeg-formats-dialog.component.html
│   │   └── ffmpeg-formats-dialog.component.scss
│   └── ffmpeg-test/                       # Composant de test
│       └── ffmpeg-test.component.ts
src-tauri/
└── src/
    ├── lib.rs                             # Commandes enregistrées
    └── video_commands.rs                  # Nouvelles commandes FFmpeg
```

## 🛠️ Utilisation

### 1. Ouverture du dialogue

```typescript
// Dans un composant
constructor(private filesManager: FilesManagerService) {}

openFormatsDialog() {
  this.filesManager.openFfmpegFormatsDialog().then((selectedFormat) => {
    if (selectedFormat) {
      console.log('Format sélectionné:', selectedFormat);
      // Utiliser le format pour la conversion
    }
  });
}
```

### 2. Utilisation directe du service

```typescript
// Injection du service
constructor(private ffmpegService: FfmpegFormatsService) {}

// Vérifier la disponibilité
const isAvailable = this.ffmpegService.ffmpegInfo().available;

// Vérifier un format spécifique
const isSupported = this.ffmpegService.isFormatSupported('mp4');

// Récupérer les formats courants
const commonFormats = this.ffmpegService.getCommonVideoFormats();

// Rechercher des formats
const results = this.ffmpegService.searchFormats('webm');
```

## 🎨 Interface utilisateur

### Dialogue principal

- **Onglet "Courants"** : Formats les plus utilisés (MP4, MOV, AVI, etc.)
- **Onglet "Haute qualité"** : Formats optimisés pour la qualité
- **Onglet "Mobile"** : Formats compatibles avec les appareils mobiles
- **Onglet "Tous"** : Liste complète avec recherche

### États visuels

- 🟢 **Disponible** : FFmpeg installé et fonctionnel
- 🔴 **Non disponible** : FFmpeg manquant ou inaccessible
- ⏳ **Chargement** : Vérification en cours
- ⚠️ **Erreur** : Message d'erreur avec bouton de réessai

## 🔧 Commandes Rust

### Nouvelles commandes ajoutées

```rust
// Vérifier si FFmpeg est disponible
check_ffmpeg_available() -> Result<bool, String>

// Vérifier si ffprobe est disponible
check_ffprobe_available() -> Result<bool, String>

// Récupérer tous les formats de sortie
get_ffmpeg_output_formats() -> Result<Vec<FfmpegFormat>, String>
```

### Structure des données

```rust
pub struct FfmpegFormat {
    pub name: String,           // Nom du format
    pub description: String,    // Description
    pub extensions: Vec<String> // Extensions associées
}
```

## 📊 Catégories de formats

### Formats courants

- **MP4** : Format standard, excellent compatibilité
- **MOV** : Format Apple, haute qualité
- **AVI** : Format classique Windows
- **MKV** : Format conteneur flexible
- **WebM** : Format web moderne
- **FLV** : Format Flash (legacy)
- **WMV** : Format Windows Media
- **M4V** : Format iTunes

### Formats haute qualité

- **MP4** : Avec codecs H.264/H.265
- **MOV** : Qualité professionnelle
- **MKV** : Support multi-pistes
- **WebM** : Optimisé pour le web

### Formats mobile

- **MP4** : Compatible tous appareils
- **3GP** : Optimisé pour mobile
- **M4V** : Compatible iOS

## 🔍 Fonctionnalités avancées

### Recherche intelligente

- Recherche par nom de format
- Recherche par description
- Filtrage en temps réel
- Suggestions automatiques

### Validation automatique

- Vérification de la disponibilité FFmpeg
- Validation des formats supportés
- Gestion des erreurs de commande
- Messages d'erreur explicites

### Performance optimisée

- Chargement asynchrone
- Mise en cache des résultats
- Actualisation manuelle
- Gestion des états de chargement

## 🎯 Intégration

### Dans la barre d'outils

1. Menu principal → "Formats FFmpeg"
2. Ouverture du dialogue complet
3. Sélection et utilisation du format

### Dans le code

```typescript
// Vérifier avant conversion
if (this.ffmpegService.isFormatSupported(targetFormat)) {
  // Procéder à la conversion
} else {
  // Afficher un message d'erreur
}
```

## 🐛 Gestion d'erreurs

### Types d'erreurs gérées

- **FFmpeg non installé** : Message avec instructions d'installation
- **Erreur de commande** : Affichage de l'erreur spécifique
- **Erreur de parsing** : Gestion des données malformées
- **Erreur réseau** : Retry automatique

### Messages d'erreur

- Messages en français
- Instructions claires
- Boutons d'action (réessayer, installer)
- Logs détaillés en console

## 📱 Responsive Design

### Desktop (>768px)

- Grille de cartes 2-3 colonnes
- Onglets horizontaux
- Recherche en barre complète

### Mobile (≤768px)

- Liste verticale
- Navigation par onglets
- Recherche optimisée tactile

## 🚀 Installation requise

### FFmpeg

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Télécharger depuis https://ffmpeg.org/download.html
```

### Vérification

Le module vérifie automatiquement la disponibilité de FFmpeg au démarrage de l'application.

## 🎉 Résultat final

Le module FFmpeg Formats est maintenant **entièrement fonctionnel** et intégré dans l'application. Il permet aux utilisateurs de :

✅ **Découvrir** tous les formats supportés par FFmpeg  
✅ **Rechercher** des formats spécifiques  
✅ **Sélectionner** le format optimal pour leurs besoins  
✅ **Valider** la compatibilité avant conversion  
✅ **Comprendre** les capacités de leur installation FFmpeg

Le module s'intègre parfaitement dans l'interface existante et peut être facilement étendu pour intégrer la sélection de formats dans le processus de conversion vidéo.
