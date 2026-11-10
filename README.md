# Morse — The signal studio

A static, privacy-first signal studio. The app is designed to run entirely in the browser: no account, no application backend, no content analytics and no message upload.

## Product capabilities

- **Overview** — product landing page, feature tour, FAQ and local-only recent activity.
- **Encoder / Decoder** — International Morse letters, numbers and punctuation, selected Arabic/Urdu extension mappings, prosigns in the reference, audio playback with WPM/Farnsworth/tone controls, WAV export, screen flash, vibration and tap-to-key.
- **Alphabet** — Morse reference and common prosigns.
- **Practice** — letter recognition quiz.
- **Cipher Lab / Codebook** — custom emoji word maps, templates, manual edits, Unicode character fallback, JSON import/export, fragment-only sharing and square/story image-card export. This is **obfuscation, not encryption**.
- **Cipher Lab / Secure** — Web Crypto AES-256-GCM, PBKDF2-SHA-256 (600,000 iterations), random 16-byte salt and 12-byte nonce, emoji transport and optional Morse-over-base64 layer. Wrong passphrase or tampering fails authentication.
- **Secret Room** — creates a random 256-bit key in a URL fragment. The key is a bearer secret: anyone with the complete link can use it. Use a private channel.
- **Local controls** — encrypted-at-rest saved codebook, local-only history, optional best-effort clipboard clearing, panic wipe, dark/light theme and offline service-worker cache.
- **PWA** — installable manifest and offline app-shell caching.

## Project structure

```text
.
├── index.html
├── about/index.html
├── encoder/index.html
├── decoder/index.html
├── alphabet/index.html
├── cipher/index.html
├── practice/index.html
├── app.js
├── style.css
├── vercel.json
├── manifest.webmanifest
├── sw.js
├── robots.txt
├── sitemap.xml
├── llms.txt
├── llms-full.txt
├── logo.svg
├── favicon.svg
├── favicon.ico
├── apple-touch-icon.png
├── apple-touch-icon.svg
├── icon-192.png
├── icon-512.png
├── pwa-icon.svg
├── pwa-192.svg
├── pwa-512.svg
├── cloudexify.svg
└── og-image.svg
```

## Run locally

Serve this directory with any static HTTP server. Service workers, Web Crypto and clipboard APIs require a secure context (HTTPS or localhost). Opening the files directly with `file://` will disable some browser features.

Example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Vercel

The repository is static and deploys from the root. `vercel.json` applies a restrictive Content Security Policy and security headers. No build command or environment variables are required.

## Security notes

- Codebook is a playful substitution scheme. It does not provide cryptographic confidentiality.
- Secure mode encrypts in the browser with AES-GCM. The passphrase is never saved. There is no recovery mechanism.
- The PBKDF2 iteration count is 600,000. Encryption may take a moment on low-end phones.
- The Secret Room URL fragment contains the generated key. Treat the complete link like a password.
- URL fragments are not included in normal HTTP requests, but can still be exposed by screenshots, copied links, browser history, synced devices or anyone you send them to.
- Panic wipe clears this origin's localStorage, sessionStorage, service-worker registration and Cache Storage. It cannot erase copies, screenshots, browser backups or data held by clipboard managers.
- Arabic/Urdu mappings are an app-specific extension and are not claimed to be a universally standardized Morse alphabet.
- Flash, vibration, clipboard, share sheet and offline capabilities vary by browser/device.

## Known asset limitation

Brand, favicon, OG and PWA artwork are supplied as SVG. Some Apple home-screen workflows and older social preview crawlers prefer raster PNG/ICO assets; add generated PNG/ICO variants before claiming universal icon compatibility. The app currently uses shareable fragment links rather than generating QR images locally.

## Test checklist

1. Encode `HELLO WORLD` → `.... . .-.. .-.. --- / .-- --- .-. .-.. -..` → decode back to `HELLO WORLD`.
2. Try digits, punctuation, SOS and the Arabic/Urdu extension reference.
3. Change WPM, Farnsworth WPM and tone frequency; play audio and export a WAV.
4. Test screen flash, vibration and tap-key on supported mobile hardware; verify keyboard shortcuts on desktop.
5. In Codebook, generate a template, manually edit a word, encode/decode mapped and unknown Unicode text, then export/import JSON.
6. Save a codebook with a passphrase, reload, unlock it; verify a wrong passphrase does not unlock it.
7. Secure mode: encrypt a message, decrypt with the same passphrase, then try a wrong passphrase and modified emoji ciphertext. It must show authentication failure.
8. Repeat secure round-trip with optional Morse layer.
9. Generate a Secret Room link, open it in a second browser/device, use its key in Secure mode and verify the ciphertext round-trip.
10. Visit every route directly, confirm unique title/description/canonical, install the PWA, then go offline after the first successful load.
11. Verify panic wipe clears this origin's local storage and offline cache.

## Branding

Footer attribution: **Built by CloudExify** — CloudExify Technologies (Private) Limited, Islamabad. [cloudexify.site](https://cloudexify.site).
