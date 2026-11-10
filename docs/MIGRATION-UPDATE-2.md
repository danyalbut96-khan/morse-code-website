# Update 2 migration notes

## Existing saved codebooks
- Update 2 does **not** rewrite or delete `morse-encrypted-book`.
- Existing Update 1 codebooks continue to use the existing passphrase-based AES-GCM envelope and can still be unlocked from Cipher Lab with the original storage passphrase.
- The new contact vault uses a separate localStorage key: `morse-contacts-v1`. Creating or unlocking it does not modify the saved codebook.
- Panic wipe clears both systems because it clears this site's local storage and caches.

## Existing ciphertext and Secret Room links
- Existing Update 1 passphrase ciphertext and Secret Room fragments remain on the legacy Secure tab and retain their original format.
- ECDH contact messages use a new versioned JSON envelope (`v: 1`, algorithm label `ECDH-P256/HKDF-SHA256/AES-256-GCM`). They are not interchangeable with the legacy PBKDF2 passphrase format.
- Keep the original passphrase or Secret Room link if you need to decrypt old messages. Do not assume a new ECDH contact can decrypt a legacy payload.

## Contact vault
- Create a local PIN vault once, then generate a separate ECDH P-256 invite key for each friend.
- Exchange public JWKs only. Never export or send the private PKCS#8 key.
- After adding a friend's public key, compare the emoji + six-digit fingerprint out of band.
- Key rotation creates new local key material for that contact; the friend must import the new public key and verify the new fingerprint.
- Revocation deletes that contact's private key material from the encrypted vault. It cannot revoke ciphertext or key copies already held by the other person.

## Recovery
There is no server-side recovery. If the local PIN is lost and no backup of the encrypted vault exists, the contact vault cannot be unlocked. Exported public keys can be exchanged again, but private keys cannot be reconstructed.
