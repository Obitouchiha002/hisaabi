/**
 * Calculator.
 *
 * Kharcha likhte waqt aksar jod-ghata karna padta hai: "3 samose 15 ke",
 * "1200 ka bill, 4 log", "500 me se 180 gaye". Iske liye doosri app kholna
 * poora flow tod deta hai.
 *
 * Ye calculator seedha usi jagah chalta hai jahan tum likh rahe ho, aur uska
 * jawab ek tap me entry ban jata hai.
 *
 * Sirf ganit — koi eval() nahi. eval me user ka likha kuch bhi chal jata hai,
 * aur paise wali app me wo risk lene ki koi wajah nahi.
 */

export interface CalcResult {
  value: number;
  /** saaf kiya hua expression, jaisa dikhana chahiye */
  expression: string;
  error?: string;
}

type Token = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'paren'; v: '(' | ')' };

/** Aam bol-chaal ke shabd bhi chalein: "ka", "me se", "%" */
const WORD_OPS: Array<[RegExp, string]> = [
  [/\b(?:plus|aur|jod|add)\b/gi, '+'],
  [/\b(?:minus|ghata|kam|less)\b/gi, '-'],
  [/\b(?:into|guna|times|x)\b/gi, '*'],
  [/\b(?:batta|divide|by|bhag)\b/gi, '/'],
  [/×/g, '*'],
  [/÷/g, '/'],
  [/−/g, '-'],
];

export function tokenize(input: string): Token[] | null {
  let s = input.trim();
  for (const [re, op] of WORD_OPS) s = s.replace(re, op);
  s = s.replace(/[₹,\s]/g, '');
  if (!s) return null;

  const tokens: Token[] = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i]!;

    if (/\d|\./.test(ch)) {
      let j = i;
      while (j < s.length && /[\d.]/.test(s[j]!)) j++;
      const v = parseFloat(s.slice(i, j));
      if (!isFinite(v)) return null;
      tokens.push({ t: 'num', v });
      i = j;
      continue;
    }

    if ('+-*/%'.includes(ch)) { tokens.push({ t: 'op', v: ch }); i++; continue; }
    if (ch === '(' || ch === ')') { tokens.push({ t: 'paren', v: ch }); i++; continue; }

    return null;   // koi anjaan akshar — ye ganit nahi hai
  }

  return tokens.length ? tokens : null;
}

/**
 * Shunting-yard se evaluate. Guna-bhag pehle, jod-ghata baad me —
 * jaise school me sikhaya jata hai, warna "100+50*2" ka jawab 300 aa jayega.
 */
export function calculate(input: string): CalcResult | null {
  const tokens = tokenize(input);
  if (!tokens) return null;

  // sirf ek number = ganit nahi
  if (tokens.length === 1 && tokens[0]!.t === 'num') return null;
  if (!tokens.some((t) => t.t === 'op')) return null;

  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 };
  const out: Token[] = [];
  const ops: Token[] = [];

  for (const tk of tokens) {
    if (tk.t === 'num') { out.push(tk); continue; }

    if (tk.t === 'paren') {
      if (tk.v === '(') { ops.push(tk); continue; }
      while (ops.length && !(ops[ops.length - 1]!.t === 'paren')) out.push(ops.pop()!);
      if (!ops.length) return { value: 0, expression: input, error: 'bracket theek nahi' };
      ops.pop();
      continue;
    }

    while (
      ops.length &&
      ops[ops.length - 1]!.t === 'op' &&
      prec[(ops[ops.length - 1] as { v: string }).v]! >= prec[tk.v]!
    ) out.push(ops.pop()!);
    ops.push(tk);
  }

  while (ops.length) {
    const top = ops.pop()!;
    if (top.t === 'paren') return { value: 0, expression: input, error: 'bracket theek nahi' };
    out.push(top);
  }

  const stack: number[] = [];
  for (const tk of out) {
    if (tk.t === 'num') { stack.push(tk.v); continue; }
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) return { value: 0, expression: input, error: 'adhoora hisaab' };

    switch ((tk as { v: string }).v) {
      case '+': stack.push(a + b); break;
      case '-': stack.push(a - b); break;
      case '*': stack.push(a * b); break;
      case '/':
        if (b === 0) return { value: 0, expression: input, error: 'zero se bhag nahi hota' };
        stack.push(a / b);
        break;
      case '%': stack.push((a * b) / 100); break;   // "1200 % 18" = 1200 ka 18%
      default: return null;
    }
  }

  const value = stack.pop();
  if (value === undefined || stack.length || !isFinite(value)) {
    return { value: 0, expression: input, error: 'samajh nahi aaya' };
  }

  return { value: Math.round(value * 100) / 100, expression: prettyExpression(input) };
}

function prettyExpression(input: string): string {
  let s = input.trim();
  for (const [re, op] of WORD_OPS) s = s.replace(re, op);
  return s
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/([+\-])/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ye line ganit hai ya kharcha?
 *
 * "chai 20" ganit nahi hai (koi operator nahi). "20+30" hai.
 * "3*15" bhi hai. Isse tay hota hai ki calculator dikhana hai ya nahi.
 */
export function looksLikeMath(input: string): boolean {
  const s = input.trim();
  if (!s || s.length > 60) return false;

  // number, operator, bracket aur space ke alawa kuch na ho
  if (!/^[\d\s+\-*/%().,₹×÷−]+$/.test(s)) return false;

  return /[+\-*/%×÷−]/.test(s) && /\d/.test(s);
}
