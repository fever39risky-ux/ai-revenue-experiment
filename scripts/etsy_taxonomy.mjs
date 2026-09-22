/**
 * Etsy taxonomy helper (run via .github/workflows/etsy-taxonomy.yml).
 *  MODE=list  PATTERN=<regex>                  -> print matching seller-taxonomy nodes with full path
 *  MODE=set   TAXONOMY_ID=<id> LISTING_IDS=a,b -> PATCH taxonomy_id on those listings
 * Tokens are masked in logs (public repo).
 */
const { ETSY_API_KEYSTRING, ETSY_API_SHARED_SECRET, ETSY_REFRESH_TOKEN, ETSY_SHOP_ID, MODE, PATTERN, TAXONOMY_ID, LISTING_IDS } = process.env;
if (!ETSY_API_KEYSTRING || !ETSY_API_SHARED_SECRET || !ETSY_REFRESH_TOKEN || !ETSY_SHOP_ID) {
  console.log('etsy_taxonomy: credentials not set -- skipping (no-op).');
  process.exit(0);
}
const mask = v => { if (v) console.log(`::add-mask::${v}`); };
mask(ETSY_REFRESH_TOKEN); mask(ETSY_API_SHARED_SECRET);
const p = new URLSearchParams();
p.set('grant_type', 'refresh_token');
p.set('client_id', ETSY_API_KEYSTRING);
p.set('refresh_token', ETSY_REFRESH_TOKEN);
const tr = await fetch('https://api.etsy.com/v3/public/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p });
const tok = await tr.json();
if (!tr.ok) { console.error('etsy_taxonomy: token refresh failed', tr.status); process.exit(1); }
mask(tok.access_token); mask(tok.refresh_token);
const headers = { Authorization: `Bearer ${tok.access_token}`, 'x-api-key': `${ETSY_API_KEYSTRING}:${ETSY_API_SHARED_SECRET}` };

if (MODE === 'set') {
  for (const id of String(LISTING_IDS || '').split(',').map(s => s.trim()).filter(Boolean)) {
    const res = await fetch(`https://api.etsy.com/v3/application/shops/${ETSY_SHOP_ID}/listings/${id}`, {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ taxonomy_id: Number(TAXONOMY_ID) }) });
    const j = await res.json();
    console.log(`PATCH listing ${id} taxonomy_id=${TAXONOMY_ID} -> ${res.status} ${res.ok ? `(now ${j.taxonomy_id})` : JSON.stringify(j)}`);
    if (!res.ok) process.exitCode = 1;
  }
} else {
  const res = await fetch('https://api.etsy.com/v3/application/seller-taxonomy/nodes', { headers });
  const j = await res.json();
  const re = new RegExp(PATTERN || 'template', 'i');
  (function walk(list, path) {
    for (const n of list || []) {
      const full = [...path, n.name];
      if (re.test(n.name)) console.log(`${n.id}\t${full.join(' > ')}${(n.children || []).length ? '' : '  [leaf]'}`);
      walk(n.children, full);
    }
  })(j.results, []);
}
