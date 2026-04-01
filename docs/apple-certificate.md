# macOS Code Signing & Notarization

This document explains how to configure code signing and notarization for Marka's macOS builds so that Gatekeeper accepts the app without warnings.

## Prerequisites

- An **Apple Developer account** (paid, $99/year)
- A **Developer ID Application** certificate in your Keychain
- Access to the GitHub repository secrets

---

## Step 1 — Get your Developer ID Application certificate

If you already have one, skip to Step 2.

1. Go to [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles**
2. Click `+` → select **Developer ID Application** → Continue
3. Follow the instructions to generate a CSR from Keychain Access and submit it
4. Download and double-click the certificate to install it in your Keychain

---

## Step 2 — Export the certificate as a .p12 file

1. Open **Keychain Access** (Applications → Utilities → Keychain Access)
2. Under **My Certificates**, find **"Developer ID Application: Your Name (TEAMID)"**
3. Right-click → **Export "Developer ID Application: …"**
4. Save as `certificate.p12`, choose a location outside the project
5. Set a **strong password** when prompted — you will need it in Step 4

---

## Step 3 — Convert the certificate to base64

Run this in Terminal:

```bash
base64 -i certificate.p12 | pbcopy
```

This copies the base64-encoded certificate string to your clipboard.

---

## Step 4 — Create an app-specific password for notarization

Apple requires a dedicated password for automated notarization (your main Apple ID password cannot be used).

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in → **Sign-In and Security** → **App-Specific Passwords**
3. Click `+` and name it `github-actions-notarize`
4. Copy the generated password — it is shown only once

---

## Step 5 — Add secrets to GitHub

Go to your repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Add the following 6 secrets:

| Secret name | Value |
|---|---|
| `APPLE_CERTIFICATE` | Base64 string from Step 3 |
| `APPLE_CERTIFICATE_PASSWORD` | Password set in Step 2 |
| `APPLE_SIGNING_IDENTITY` | Full certificate name, e.g. `Developer ID Application: John Doe (ABC123XYZ)` |
| `APPLE_ID` | Your Apple ID email address |
| `APPLE_PASSWORD` | App-specific password from Step 4 |
| `APPLE_TEAM_ID` | Your 10-character team ID (visible at developer.apple.com, top-right corner) |

> The `APPLE_SIGNING_IDENTITY` must match exactly the name shown in Keychain Access.

---

## Step 6 — Update the GitHub Actions workflow

Add the signing secrets to the `env` block of the `Build and release` step in `.github/workflows/release.yml`:

```yaml
      - name: Build and release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

`tauri-action` picks up these variables automatically and handles signing and notarization during the build.

---

## How it works

1. **Signing** — Xcode tools sign the `.app` bundle with your Developer ID certificate, identifying you as the publisher.
2. **Notarization** — The signed app is uploaded to Apple's notary service, which scans it for malware and attaches a ticket.
3. **Stapling** — The notarization ticket is stapled to the `.dmg`, so Gatekeeper accepts it even offline.

Once configured, users will see no warning when opening Marka — it will open like any App Store app.

---

## Troubleshooting

**"No identity found"** — The `APPLE_SIGNING_IDENTITY` value doesn't match the certificate name exactly. Copy it directly from Keychain Access.

**Notarization timeout** — Apple's notary service can take a few minutes. `tauri-action` waits up to 10 minutes by default; re-run the workflow if it times out.

**"Certificate is not valid"** — The certificate may have expired (Developer ID certs are valid for 5 years) or been revoked. Regenerate it on developer.apple.com.
