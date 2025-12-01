---
description: How to deploy Version 1.0 and release to Snap Store
---

# Deploying Version 1.0

## 1. Prepare the Release
Before tagging, ensure the version numbers are correct.

1.  Update version to `1.0.0` in:
    *   `package.json`
    *   `src-tauri/tauri.conf.json`
    *   `snap/snapcraft.yaml`
2.  Commit these changes:
    ```bash
    git add .
    git commit -m "chore: bump version to 1.0.0"
    git push
    ```

## 2. Trigger GitHub Release (Win/Mac/Linux)
The GitHub Actions workflow is configured to run on tags starting with `v`.

1.  Create and push the tag:
    ```bash
    git tag v1.0.0
    git push origin v1.0.0
    ```
2.  Go to the GitHub repository -> **Actions** tab.
3.  Watch the **Release** workflow.
4.  Once complete, a new **Draft Release** will be created on GitHub with the `.deb`, `.AppImage`, `.msi`, and `.dmg` files attached.
5.  Review and publish the release.

## 3. Snap Store Deployment
Since we haven't automated Snap in CI yet, perform this manually from your local machine (Linux).

### Prerequisites
*   `snapcraft` installed: `sudo snap install snapcraft --classic`
*   A registered name on Snapcraft.io (e.g., `video-optimizer`).
*   You are logged in: `snapcraft login`

### Build & Upload
1.  **Build the local binaries** (needed for the snap source):
    ```bash
    npm run tauri build
    ```
2.  **Build the Snap package**:
    ```bash
    snapcraft
    ```
    *This will generate a file like `video-optimizer_1.0.0_amd64.snap`.*

3.  **Upload to Snap Store**:
    ```bash
    snapcraft upload --release=stable video-optimizer_1.0.0_amd64.snap
    ```
