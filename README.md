# Morse — The signal studio

A static, privacy-first signal studio. Translation and supported cryptographic operations run in the browser; there is no account or message-processing backend.

## Product capabilities

- **Encoder / Decoder** — International Morse letters, digits, punctuation and selected app-specific Arabic/Urdu mappings; audio, WAV, screen flash, vibration and tap-to-key controls.
- **Alphabet / Practice** — Morse reference, common prosigns and a letter-recognition quiz.
- **Cipher Lab / Codebook** — Custom emoji word maps, templates, Unicode fallback and JSON import/export. This is **obfuscation, not encryption**.
- **Cipher Lab / Legacy Secure** — AES-256-GCM with PBKDF2-SHA-256 (600,000 iterations), random salt and nonce, emoji transport and optional Morse transport. Existing Update 1 messages remain supported.
- **Contacts / ECDH Secure** — Per-contact P-256 ECDH key exchange, HKDF-SHA-256 key derivation and AES-256-GCM message encryption. Safety fingerprints are four emoji plus a six-digit code and must be checked out of band.
- **Contact vault** — Contact private keys are encrypted at rest using AES-256-GCM with a PIN-derived PBKDF2-SHA-256 key.
- **Expiring messages** — Authenticated expiry timestamps, fixed-size payload padding buckets and a best-effort view-once display timer.
- **Local app lock** — Optional PIN screen for casual access control. It is not full-disk encryption and does not encrypt every browser storage item.
- **Stealth Lab** — AES-GCM encrypted messages, emoji/word-list/zero-width disguises, PNG LSB steganography, expiry, view-once and optional decoy envelope.
- **Camera and audio tools** — Experimental camera light reception, torch transmission, microphone tone decoding and animated WebM signal export.
- **Koch learning path** — Progressive letter groups, local streaks and score.
- **Language / onboarding** — Three-screen onboarding, theme support, preference toggles and a navigation translation starter for Urdu, Arabic and Hindi. Full-page localization remains incomplete.
- **Sharing / distribution** — PWA share target, QR sharing for codebooks, contact keys and secure payloads; a standalone widget and iframe loader; a dependency-free Morse core package; and a Manifest V3 Chrome extension.
- **PWA sharing** — A POST share target is intercepted by the service worker and stored in the local cache before /share opens and lets the user send shared text to Encoder or Cipher Lab.
- **Privacy / How it works** — Dedicated explanations of local processing, browser APIs and limitations.
- **Existing Update 1 features** — CloudExify branding, panic wipe, SEO, llms.txt, sitemap, robots, PWA and strict security headers remain.

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
├── contacts/index.html
├── privacy/index.html
├── how-it-works/index.html
├── share/index.html
├── app.js
├── crypto-core.js
├── contacts.js
├── tests/crypto-core.test.cjs
├── docs/THREAT-MODEL.md
├── docs/MIGRATION-UPDATE-2.md
├── package.json
├── vercel.json
├── manifest.webmanifest
├── sw.js
├── robots.txt
├── sitemap.xml
├── llms.txt
├── llms-full.txt
└── branding and PWA assets
```

## Run locally

Use Node.js 22 or later for the test suite:

```bash
npm test
```

Serve the repository root with a static HTTP server for browser testing. Web Crypto, service workers, clipboard and media APIs require HTTPS or localhost.

## Security notes

- Codebook is reversible obfuscation, not cryptographic confidentiality.
- Legacy Secure uses a passphrase; ECDH Contacts uses exchanged public keys. The formats are not interchangeable.
- Never send a private key. Exchange public JWKs only and compare safety fingerprints through a separate trusted channel.
- Contact vault data is encrypted at rest, but the app lock only gates the UI; it does not encrypt all browser storage.
- Expiry is checked against the recipient device clock. View-once is best-effort and cannot prevent screenshots or copying.
- Fixed-size padding hides exact message length but reveals the bucket size.
- Panic wipe clears this origin's localStorage, sessionStorage, service-worker registration and Cache Storage. It cannot erase screenshots, backups, copies or clipboard-manager history.
- See docs/THREAT-MODEL.md and docs/MIGRATION-UPDATE-2.md.

## Not included in this Update 2 delivery

Argon2id WASM is not included. The local six-word passphrase generator uses a compact bundled word bank and is Diceware-style, not the official 7776-word Diceware list. Full four-language page localization is not complete. Argon2id WASM is not bundled; PBKDF2-SHA-256 is used for the new passphrase envelope. The word-list generator is a compact Diceware-style list, not the official 7776-word list. QR image scanning depends on BarcodeDetector support. Analytics are optional local route counters only and are never transmitted. Camera light reading is experimental and requires device testing.

## Test checklist

1. Run npm test and confirm both the ECDH round-trip, wrong-key rejection, expired-message rejection, view-once metadata and wrong-PIN vault tests pass.
2. Generate two independent ECDH pairs on two browsers/devices; exchange only public JWKs.
3. Confirm both users see the same emoji + six-digit fingerprint and verify it out of band before encrypting.
4. Encrypt and decrypt between the two devices; alter the envelope and test with an unrelated key.
5. Test expiry using a short future timestamp and verify decryption is refused after expiry.
6. Verify view-once clears the local display after 15 seconds; confirm this is not treated as guaranteed deletion.
7. Create and unlock the contact vault; test incorrect PIN, lock/reopen, rotation and revocation.
8. Confirm existing encrypted codebooks still unlock using the original storage passphrase.
9. Confirm existing passphrase ciphertext and Secret Room links still work in the legacy Secure tab.
10. Install the PWA, share text from another app, and confirm /share opens with the shared text.
11. Test direct navigation to every page, offline shell loading, keyboard focus and reduced-motion behavior.
12. Test the public embed route in an external parent page, and test camera/torch/microphone behavior on supported physical devices.\n13. Test QR rendering, QR image import where BarcodeDetector is available, and large-payload overflow handling.\n14. Test emoji, English/Urdu word-list, zero-width and PNG hide/extract round-trips before decrypting.\n15. Test the extension by loading the extension/ folder as an unpacked Manifest V3 extension.\n16. Run the Morse core package tests and verify the package can be packed for npm publication.

## Branding

Footer attribution: **Built by CloudExify** — CloudExify Technologies (Private) Limited, Islamabad. [cloudexify.site](https://cloudexify.site).
