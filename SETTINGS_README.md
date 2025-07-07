# Paramètres de l'Application

## Fonctionnalités ajoutées

### Popup de Paramètres

Un popup de paramètres a été ajouté à l'application avec les fonctionnalités suivantes :

#### 1. Clé API The Movie Database (TMDB)

- **Champ de saisie sécurisé** : La clé API est masquée pour la sécurité
- **Lien direct** : Lien vers la page d'obtention de clé API sur themoviedb.org
- **Stockage local** : La clé est sauvegardée localement dans le navigateur

#### 2. Préférences de Thème

- **Auto (système)** : Utilise automatiquement le thème du système d'exploitation (par défaut)
- **Clair** : Force l'utilisation du thème clair
- **Sombre** : Force l'utilisation du thème sombre

## Utilisation

### Accès aux paramètres

1. Cliquez sur l'icône ⚙️ (engrenage) dans la barre d'outils
2. Le popup de paramètres s'ouvre

### Configuration de la clé API TMDB

1. Rendez-vous sur [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
2. Créez un compte gratuit si nécessaire
3. Générez une clé API
4. Copiez la clé et collez-la dans le champ "Clé API The Movie Database"

### Configuration du thème

1. Sélectionnez votre préférence dans le menu déroulant "Thème"
2. Les changements sont appliqués immédiatement

## Fonctionnalités techniques

### Service de Paramètres (`SettingsService`)

- **Stockage persistant** : Utilise localStorage pour sauvegarder les paramètres
- **Observable** : Notifie les composants des changements de paramètres
- **Valeurs par défaut** : Thème "auto" et clé API vide

### Composant de Dialogue (`SettingsDialogComponent`)

- **Design responsive** : S'adapte aux différentes tailles d'écran
- **Validation** : Interface utilisateur intuitive
- **Actions** : Boutons Enregistrer, Annuler et Réinitialiser

### Intégration avec le thème

- **Détection automatique** : Utilise l'API Tauri pour détecter le thème système
- **Application dynamique** : Les changements de thème sont appliqués en temps réel
- **Persistance** : Les préférences sont conservées entre les sessions

## Structure des fichiers

```
src/
├── services/
│   └── settings.service.ts          # Service de gestion des paramètres
├── components/
│   └── settings-dialog/
│       ├── settings-dialog.component.ts
│       ├── settings-dialog.component.html
│       └── settings-dialog.component.scss
└── app/
    ├── app.component.ts             # Intégration du popup
    ├── app.component.html           # Bouton de paramètres
    └── app.component.scss           # Styles de la toolbar
```

## API utilisée

### The Movie Database (TMDB)

- **URL** : https://www.themoviedb.org/
- **API** : REST API gratuite
- **Limitations** : 1000 requêtes par jour pour les comptes gratuits
- **Documentation** : https://developers.themoviedb.org/3

## Notes de développement

- Les paramètres sont stockés localement dans le navigateur
- Le thème "auto" respecte les préférences système de l'utilisateur
- L'interface est entièrement en français comme demandé
- Le code utilise Angular Material pour une interface cohérente
