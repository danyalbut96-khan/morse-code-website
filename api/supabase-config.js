'use strict';
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(503).json({ error: 'Secret Rooms are not configured yet.' }); }
  if (parsed.protocol !== 'https:' || !key || !/^[a-z0-9-]+\.supabase\.(co|in)$/i.test(parsed.hostname)) {
    return res.status(503).json({ error: 'Secret Rooms are not configured yet.' });
  }
  return res.status(200).json({ url: parsed.origin, key });
};
