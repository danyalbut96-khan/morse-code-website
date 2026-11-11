# Update 3 deployment notes (foundation stage)

## Current status
The Cipher Library is local and offline-capable. The Supabase migration here is a database foundation only; this change does not enable a room client, Auth UI, billing, cloud backup, or REST API.

## Environment variables
Browser-safe, only when a client integration is ready:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY (publishable/anon key only; RLS is mandatory)

Server-only; never expose with a VITE_ prefix:
- SUPABASE_SERVICE_ROLE_KEY (privileged cleanup/admin tasks only)
- ROOM_CLEANUP_SECRET (scheduled cleanup endpoint authorization)
- PAYMENT_PROVIDER_SECRET (reserved for a future billing adapter)
- PAYMENT_WEBHOOK_SECRET (reserved for a future webhook signature verifier)

Do not set unused variables until the corresponding server feature exists. Never commit .env files.

## Vercel + Supabase
1. Keep the current static PWA deploy unchanged while testing this branch preview.
2. Create a separate Supabase staging project; enable anonymous Auth only after abuse controls are designed.
3. Apply supabase/migrations/202611110001_update3_room_foundation.sql to staging.
4. Run supabase/tests/room_rls.test.sql with pgTAP in a disposable test database. It checks schema/RLS presence only; add identity-switched integration tests before production.
5. Configure Vercel browser variables only when a client integration is ready. Keep service-role and webhook secrets server-only.
6. Test expiry cleanup, capacity races, anonymous identity persistence, RLS isolation, Realtime reconnects and mobile sleep/resume.
7. Do not claim rooms are live until an end-to-end implementation and test suite is merged.

## Launch gates
- [ ] Existing Morse, contacts, Stealth Lab and PWA tests pass.
- [ ] Cipher round-trip tests pass for every supported encoding.
- [ ] RLS isolation tests run against real Supabase staging identities.
- [ ] E2E tests cover room create/join/send/receive/expiry/capacity/reconnect.
- [ ] Independent crypto review completed.
- [ ] CSP allowlist is narrowed to exact Supabase endpoints only when client integration is added.
- [ ] Privacy policy reflects provider metadata, auth identifiers, retention and backups.
- [ ] Lighthouse, WCAG AA, Android/iOS and RTL results are measured on production-like builds.
