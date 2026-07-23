/**
 * CORS — sirf hamari apni app ke liye.
 *
 * Android me app WebView me chalti hai aur uska origin `https://localhost`
 * hota hai, hamara domain nahi. Bina in headers ke browser har request rok
 * deta hai — APK me AI aur email login dono chup-chaap fail hote the.
 *
 * `*` jaan-boojh kar nahi likha: tab koi bhi website hamare AI endpoint pe
 * request maar sakti hai aur quota (aur bill) hamara jata.
 */

const ALLOWED = new Set([
  'https://localhost',        // Capacitor — Android
  'http://localhost',
  'capacitor://localhost',    // Capacitor — iOS
  'https://hisaabii.vercel.app',
  'http://localhost:4173',    // local preview
  'http://localhost:5180',    // vite dev
  'http://10.0.2.2:4173',     // emulator se local preview
]);

/**
 * Headers laga do. `true` mile to request yahin khatam — OPTIONS (preflight)
 * ka jawab de diya gaya hai, handler ko aage kuch nahi karna.
 */
export function cors(req, res) {
  const origin = req.headers?.origin;

  if (origin && ALLOWED.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    // jawab origin ke hisaab se badalta hai — CDN ko batana zaroori hai
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
