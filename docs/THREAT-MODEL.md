# Morse Signal Studio — threat model (Update 2)

## Security goals
- Keep plaintext, private ECDH keys, local contact records and cryptographic operations on the user's device.
- Provide authenticated message confidentiality between two users who correctly exchange P-256 public keys and verify the same safety fingerprint.
- Reject ciphertext modification, wrong keys and authenticated messages whose embedded expiry has passed.
- Encrypt the local contact vault at rest using a PIN-derived AES-256-GCM key.

## What the app can help protect against
- Passive network observers: message plaintext and contact private keys are not sent to an application server.
- Casual inspection of browser storage: contact vault records are encrypted with AES-GCM; a PIN is required to unlock them.
- Ciphertext tampering and incorrect ECDH keys: AES-GCM authentication rejects modified data or an unrelated key.
- Accidental disclosure of message length: optional fixed-size buckets reduce precision, but reveal the selected bucket.
- Delayed reading: expiry is authenticated inside the encrypted payload and checked during decryption.

## What it does not protect against
- A compromised, rooted, infected or physically accessible device; malware, browser extensions, keyloggers and screen capture can read plaintext while the app is unlocked.
- Weak/reused PINs, shoulder-surfing, coercion, or an attacker who can repeatedly attempt offline PIN guesses against a copied vault.
- Public-key substitution or man-in-the-middle attacks when users do not compare the safety fingerprint through an independent trusted channel.
- Metadata: IP addresses, timing, message delivery, approximate padded size, and use of the website may be visible to network or hosting providers.
- Traffic analysis, screenshots, copied messages, clipboard managers, notifications, backups or recipient-created copies.
- Guaranteed one-time reading. A view-once UI can clear its local display, but cannot prevent screenshots, memory inspection or a recipient saving the plaintext.
- Guaranteed deletion from storage hardware or backups. Browser storage clearing is best-effort.
- A decoy message as cryptographic deniability. It is a UI convenience, not proof that another ciphertext or key does not exist.

## Key-exchange ceremony
1. Each person generates a P-256 ECDH key pair locally.
2. They exchange only public JWKs over a channel they believe is authentic.
3. Both derive the same 256-bit ECDH secret and an AES-256-GCM key through HKDF-SHA-256.
4. Both compare the four-emoji and six-digit safety fingerprint over a separate trusted channel.
5. If the fingerprint differs, stop; do not send sensitive messages. Rotate keys and repeat the verification.

## Cryptographic choices
- ECDH: NIST P-256 through Web Crypto.
- Key derivation: HKDF-SHA-256 with sorted public-key context and an application-specific info string.
- Message encryption: AES-256-GCM with a fresh 96-bit nonce and authenticated application context.
- Contact vault: PBKDF2-HMAC-SHA-256 (310,000 iterations), random 128-bit salt, AES-256-GCM.
- Expiry is enforced by the decoder clock. A user with control of their device clock can alter local time; expiry is not a trusted timestamp authority.

## Important distinction
Codebook is obfuscation. Secure mode is encryption. Emoji, word-list, zero-width and Morse presentation layers are transport disguises only; they do not add cryptographic security.

## App lock and local vault notes
The optional app lock encrypts a verifier record with a PIN-derived key and places a lock screen over the interface. It is a casual-access barrier, not full-disk encryption: it does not encrypt all history, theme preferences, cached application assets or other browser storage. The contacts vault is separately encrypted at rest. A user with developer tools, malware or control of the browser profile can bypass the UI lock or inspect unlocked plaintext.
