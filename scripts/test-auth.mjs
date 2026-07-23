/**
 * api/auth.js ke liye test — `node scripts/test-auth.mjs`.
 *
 * Vercel ke bina chalta hai: handler ko seedha bulake fake req/res dete hain.
 * Yahan zyadatar test ye dekhte hain ki galat cheez *rukti* hai — kyunki OTP
 * me asli khatra sahi code ka na chalna nahi, galat code ka chal jana hai.
 */
process.env.AUTH_SECRET = 'test-secret-bahut-lamba-random-string-1234567890';
process.env.AUTH_DEV_CODE = '1';

const { default: handler, readToken } = await import('../api/auth.js');

function fakeRes() {
  return {
    statusCode: 0, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
const call = async (method, body) => {
  const res = fakeRes();
  await handler({ method, body }, res);
  return res;
};

let pass = 0, fail = 0;
const t = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

// health
const health = await call('GET');
t('GET health', health.body?.ok === true && health.body.configured === true, JSON.stringify(health.body));

// send
const sent = await call('POST', { action: 'send', email: 'Vansh@Example.COM ' });
const { challenge, devCode } = sent.body ?? {};
t('send → challenge + code', sent.statusCode === 200 && !!challenge && /^[A-Z0-9]{6}$/.test(devCode ?? ''), `code=${devCode}`);
t('challenge me code nahi hai', !String(challenge).includes(devCode ?? 'xx'));

// verify — sahi
const ok = await call('POST', { action: 'verify', email: 'vansh@example.com', code: devCode, challenge });
t('sahi code chalta hai', ok.statusCode === 200 && ok.body.email === 'vansh@example.com' && !!ok.body.token);

// email ka case/space matter nahi karta
const ok2 = await call('POST', { action: 'verify', email: ' VANSH@example.com ', code: devCode.toLowerCase(), challenge });
t('email/code ka case matter nahi karta', ok2.statusCode === 200);

// verify — galat code
const bad = await call('POST', { action: 'verify', email: 'vansh@example.com', code: 'AAAAAA', challenge });
t('galat code rukta hai', bad.statusCode === 401 && bad.body.error === 'wrong_code');

// verify — doosre ka email, wahi challenge
const other = await call('POST', { action: 'verify', email: 'chor@example.com', code: devCode, challenge });
t('doosre email pe wahi challenge nahi chalta', other.statusCode === 401);

// verify — chhera hua challenge
const tampered = await call('POST', { action: 'verify', email: 'vansh@example.com', code: devCode, challenge: challenge.slice(0, -3) + 'AAA' });
t('chhera hua challenge nahi chalta', tampered.statusCode === 401);

// expiry
const expired = `${Date.now() - 1000}.abcdef`;
const old = await call('POST', { action: 'verify', email: 'vansh@example.com', code: devCode, challenge: expired });
t('purana code nahi chalta', old.statusCode === 410 && old.body.error === 'code_expired');

// token
const data = readToken(ok.body.token);
t('token padha ja sakta hai', data?.email === 'vansh@example.com', JSON.stringify(data));
t('chhera hua token nahi chalta', readToken(ok.body.token.slice(0, -2) + 'zz') === null);

// bad email
const be = await call('POST', { action: 'send', email: 'not-an-email' });
t('kharab email rukta hai', be.statusCode === 400);

// 20 alag code — sab alag aur alphabet ke andar
const codes = new Set();
for (let i = 0; i < 20; i++) codes.add((await call('POST', { action: 'send', email: 'a@b.com' })).body.devCode);
t('code har baar naya', codes.size >= 18, `${codes.size}/20 alag`);
t('code me confusing akshar nahi', ![...codes].some((c) => /[O0I1L]/.test(c)));

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
