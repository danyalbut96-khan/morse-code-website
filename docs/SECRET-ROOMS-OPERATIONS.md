# Secret Rooms — deployment and security notes

## Implemented in this phase
- Anonymous Supabase Auth sessions (no email/name/phone required).
- Two-person and small-group rooms, up to 8 participants including the creator.
- The creator selects existing verified ECDH contacts. The same random room key is wrapped separately for each invitee using the existing P-256 ECDH shared secret and a room-scoped HKDF key.
- Each invite URL contains the room ID, a random invite token and that invitee's AES-GCM-wrapped room key in the URL fragment. Members can generate additional per-contact invitations until the room capacity is reached. The raw room key and raw invite token are not sent in HTTP requests.
- The database stores only a SHA-256 invite-token digest and encrypted message envelopes.
- Durable message rows use Postgres Changes; private Realtime channels carry transient Presence and typing Broadcast events.
- A database trigger limits each sender to 20 messages per room per 60 seconds.
- The local room key is saved inside the existing PIN-encrypted contacts vault.

## Supabase setup
1. Create a dedicated Supabase staging project.
2. In Authentication settings, enable Anonymous Sign-Ins. Anonymous users receive the authenticated Postgres role and an `is_anonymous` JWT claim; they are not the same thing as the unauthenticated `anon` role.
3. Apply migrations in order:
   - `supabase/migrations/202611110001_update3_room_foundation.sql`
   - `supabase/migrations/202611110002_secret_rooms_realtime.sql`
4. Ensure the Data API exposes the public schema tables/functions. The migration grants only the required columns/table operations to `authenticated`; RLS remains mandatory.
5. Keep Realtime private channels enabled. The migration adds room-membership policies on `realtime.messages` for Presence and Broadcast.
6. Run both pgTAP suites under `supabase/tests/`. The room suite checks privileges and policy presence; perform the two-user isolation test below before production.

## Vercel environment variables
Set these in Vercel Project Settings → Environment Variables:
- `SUPABASE_URL` — project URL, e.g. `https://<project-ref>.supabase.co`.
- `SUPABASE_PUBLISHABLE_KEY` — publishable key (preferred).
- `SUPABASE_ANON_KEY` — legacy anon-key fallback only.

The Vercel function `/api/supabase-config` returns only the project URL and publishable/anon key. These are browser-visible values, not secrets. Never set a service-role or secret key in this function or a `VITE_`/browser variable. No service-role key is needed by the room client.

## Local verification flow
1. Open `/contacts` on both devices/profiles.
2. Each person creates a local vault, exchanges public keys and verifies the safety fingerprint over a separate trusted channel.
3. Open `/rooms` on the creator device and unlock the contacts vault.
4. Select one or more verified contacts, choose expiry and create the room.
5. Send each invite link or its QR only to the named contact.
6. On the receiving device, unlock the vault and accept the invite. The matching verified contact is required to unwrap the room key.
7. Send messages in normal, emoji, NATO-word or Morse display mode. Inspect the Supabase table: only nonce and ciphertext should be present.
8. Try the same invite from a third uninvited identity; it must fail. Try joining after expiry and after the member limit is reached; both must fail.

## RLS and abuse controls
- Room membership is required for reading room metadata and ciphertext rows.
- Only the creator can create a room; membership is inserted by a trigger.
- The public join RPC is SECURITY INVOKER. Privileged membership/capacity logic lives in a non-exposed `private` schema function with a fixed empty search path.
- Clients have no UPDATE or DELETE policy for messages and cannot select the invite digest.
- Realtime Presence/Broadcast uses private topics `room:<uuid>`; RLS checks room membership. Typing events are not inserted into application tables.
- The SQL trigger rate-limits message inserts to 20 per sender/room per minute. Supabase Auth and Realtime provider-level rate limits/CAPTCHA should also be configured for the project's threat profile.
- Expired rooms are rejected for new joins and message inserts. To physically delete expired rooms and cascade their ciphertext, enable pg_cron and schedule the cleanup function, for example:
  ```sql
  select cron.schedule(
    'cleanup-expired-signal-rooms',
    '*/5 * * * *',
    $$select private.cleanup_expired_signal_rooms();$$
  );
  ```
  Run this only after enabling pg_cron and confirming the project permits the extension. Do not expose the cleanup function to browser roles.

## What the provider can still observe
This is zero-knowledge message content, not zero metadata. Supabase, Vercel and network infrastructure can still observe IP/network information, anonymous Auth user IDs, room IDs, membership, message timestamps, approximate ciphertext sizes, connection durations and transient Realtime traffic. Do not claim "no metadata logging". The app itself does not persist typing/online events or message plaintext.

## Important limits
- All participants must already have a verified ECDH contact with the room creator on that device. The invitee's private key remains inside their PIN-encrypted local vault.
- Anonymous identities and room keys are device/browser scoped. Clearing site data, losing the device or losing the vault PIN can make access unrecoverable. Cross-device sync is a later Pro feature.
- Invite links are bearer capabilities. Anyone who obtains a link can attempt to join until expiry/capacity is reached. A member who already received the room key can retain it; expiry does not revoke copies.
- Group key rotation on member removal is not implemented in this phase. Any current member who has the invite token and verified contacts can generate additional invites until capacity is reached; do not share the invite token outside the group. Do not remove a member and assume they lose access to old or future room content.
- Message contents are encrypted client-side with AES-256-GCM; the room key is wrapped to each member using ECDH P-256 + HKDF-SHA-256. This has not received an independent cryptographic audit.
- Realtime reconnect, mobile sleep/resume, provider abuse controls and real two-user RLS isolation must be verified against a staging Supabase project before production.
- The CDN client is version-pinned to `@supabase/supabase-js@2.119.0`. It is not self-hosted and does not yet carry an SRI hash; a later supply-chain hardening pass should vendor it or add a verified SRI digest.
