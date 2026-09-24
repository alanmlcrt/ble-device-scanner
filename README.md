# 🐬 BLE Device Scanner | BLE Detection Tool

Outil web de détection Bluetooth Low Energy (BLE) conçu spécifiquement pour identifier les appareils **Flipper Zero** à proximité.

![BLE Device Scanner Preview](https://img.shields.io/badge/Status-Active-brightgreen)
![Tech](https://img.shields.io/badge/Tech-Web_Bluetooth_API-blue)
![Browser](https://img.shields.io/badge/Browser-Chrome_Only-orange)

## 🚀 Fonctionnalités

- **Scan Passif** : Détecte les Flipper Zero sans établir de connexion (respect de la vie privée).
- **Identification Précise** : Utilise le Company ID (`0x0171`) et le préfixe d'adresse MAC (`80:E1:26`) pour filtrer les appareils.
- **Interface Cyberpunk** : Design moderne, sombre et dynamique avec des animations de circuit et de radar.
- **Logs en Temps Réel** : Console intégrée pour visualiser les annonces BLE brutes.
- **Diagnostics Système** : Vérification automatique de la compatibilité du navigateur et de l'adaptateur Bluetooth.

## 🛠️ Installation Locale

1. Clonez le dépôt :
   ```bash
   git clone https://github.com/alanmlcrt/ble-device-scanner.git
   cd ble-device-scanner
   ```

2. Lancez avec Docker Compose :
   ```bash
   docker-compose up -d
   ```

3. Accédez à l'application sur `http://localhost:8080`.

## 🌐 Déploiement sur Dokploy

Pour déployer cette application sur votre instance **Dokploy** :

1. **Créer un Projet** : Allez sur votre tableau de bord Dokploy et créez un nouveau projet (ex: "Flipper Tool").
2. **Ajouter un Service** : Choisissez **"Compose"** pour utiliser le fichier `docker-compose.yml` existant.
3. **Source du Code** :
   - Sélectionnez **GitHub**.
   - Connectez votre compte et choisissez le dépôt `ble-device-scanner`.
   - Sélectionnez la branche `main`.
4. **Configuration** :
   - Dokploy détectera automatiquement le fichier `docker-compose.yml`.
   - Vérifiez que le port exposé est bien configuré (par défaut 80 dans le conteneur).
5. **Déployer** : Cliquez sur **Deploy**.
6. **Domaine** : Ajoutez un domaine ou utilisez le sous-domaine généré par Dokploy. **Important** : L'API Web Bluetooth nécessite **HTTPS** pour fonctionner.

> [!IMPORTANT]
> **HTTPS Obligatoire** : L'API Web Bluetooth ne fonctionne que dans un contexte sécurisé (localhost ou HTTPS). Assurez-vous d'activer SSL sur Dokploy.

## ⚠️ Configuration Chrome

Pour le scan passif, vous devez activer les fonctionnalités expérimentales de Chrome :
1. Allez sur `chrome://flags/#enable-experimental-web-platform-features`.
2. Activez le flag (**Enabled**).
3. Relancez Chrome.

---
Développé avec ❤️ pour la communauté Flipper Zero.
