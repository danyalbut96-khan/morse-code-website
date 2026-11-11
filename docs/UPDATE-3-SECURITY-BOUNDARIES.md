# Update 3 security boundaries and threat model

## Security invariants
- Plaintext, ECDH private keys, derived AES keys, room-fragment secrets and decrypted messages stay in the browser.
- URL fragments are not sent in HTTP requests. Room identifiers and an invite-token digest may be sent to the service.
- The database stores encrypted envelopes only: algorithm, nonce, ciphertext, key version, room/sender identifiers and timestamps.
- Classic ciphers and text encodings do not provide confidentiality.
- A hash of an invite token is a bearer capability, not an encryption key. It must be random, high entropy, and excluded from logs and analytics.

## Metadata remains visible
Zero-knowledge content does not mean zero metadata. Supabase, hosting and network infrastructure may observe IP addresses, auth identifiers, room IDs, membership, message timing, approximate ciphertext sizes, connection duration and Realtime Presence/Broadcast traffic. Do not promise no metadata logging unless provider logs, retention, telemetry, backups and legal processing are separately configured and verified. Typing indicators should be transient events, never database rows.

## Room protocol requirements before production
1. Use Supabase anonymous identities for account-free participants, or configured login. The public anon key is not authorization.
2. Generate a random room content key and invite token locally with Web Crypto. Put room ID and token/key in the URL fragment only; derive and send only a SHA-256 invite digest to the join RPC.
3. Derive a room AES-GCM key from the existing ECDH secret using HKDF with a room-specific context and versioned info string. Do not reuse a direct-message key unchanged across rooms.
4. Authenticate room ID, sender identity, protocol version and key version as AES-GCM additional authenticated data.
5. Enforce membership, expiry, room capacity and sender identity in RLS/RPC. Never expose the service-role key to the browser.
6. Rotate keys after membership changes. Departed members may retain ciphertext already received.
7. Use immutable ciphertext rows. Cleanup expired rooms/messages through a trusted scheduled server-side job.
8. Use Realtime Presence/Broadcast for transient typing/online state. These events still expose transient metadata to the provider and connected participants.

## Limitations
- A compromised browser, extension, device, XSS, malicious deployment or stolen unlocked session can expose plaintext and keys.
- RLS protects database access but cannot prove the client encrypted correctly.
- Invite links can be copied or forwarded. Expiry and capacity are policy controls, not cryptographic revocation.
- Server timestamps, row IDs, sender IDs and payload lengths reveal activity patterns.
- No independent cryptographic audit has been performed. Obtain independent review before claiming audited or production-grade E2EE.
