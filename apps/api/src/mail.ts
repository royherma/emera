import type { Env } from './env';
import { BRAND as brand } from './brand';

// Resend allows 10 requests a second per account, shared with every project on the key.
const TRIES = 3;

export async function postResend(env: Env, body: object, wait = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return;
    if (res.status !== 429 || attempt >= TRIES) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const after = Number(res.headers.get('retry-after'));
    await wait(Math.min(2000, after > 0 ? after * 1000 : 400 * attempt));
  }
}

export const deliveryFor = (env: Env): 'log' | 'resend' => (env.RESEND_API_KEY ? 'resend' : 'log');

export async function sendCode(env: Env, email: string, code: string): Promise<void> {
  if (deliveryFor(env) === 'log') {
    console.log(`[auth] sign-in code for ${email}: ${code}`);
    return;
  }
  const name = brand.name;
  await postResend(env, {
    from: env.MAIL_FROM || `${name} <hello@emera.social>`,
    to: [email],
    subject: `${code} is your ${name} code`,
    text: `Your ${name} sign-in code is ${code}\n\nIt works for 10 minutes. If you didn't ask for it, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111"><p>Your ${name} sign-in code</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:8px 0">${code}</p><p style="color:#666">It works for 10 minutes. If you didn't ask for it, you can ignore this email.</p></div>`,
  });
}

export async function sendReportToTeam(
  env: Env,
  r: { id: string; postId: string; url: string; note: string; reporter: string },
): Promise<void> {
  if (!env.REPORTS_TO) return;
  const text = `Copy report ${r.id}\nPost: ${r.postId}\nReporter: ${r.reporter}\nCopy found at: ${r.url}\n\n${r.note || '(no note)'}`;
  if (deliveryFor(env) === 'log') {
    console.log(`[reports] ${text.replace(/\n/g, ' | ')}`);
    return;
  }
  await postResend(env, {
    from: env.MAIL_FROM || `${brand.name} <hello@emera.social>`,
    to: [env.REPORTS_TO],
    subject: `Copy report ${r.id}`,
    text,
  });
}

export async function sendWelcomeOnce(env: Env, userId: string): Promise<boolean> {
  const u = await env.DB.prepare('SELECT email, handle, protect_opt_in_at FROM users WHERE id = ?').bind(userId)
    .first<{ email: string; handle: string | null; protect_opt_in_at: number | null }>();
  if (!u?.handle) return false;
  const claim = await env.DB.prepare('INSERT OR IGNORE INTO scan_meta (key, n) VALUES (?, ?)').bind(`welcome:${userId}`, Date.now()).run();
  if (!claim.meta.changes) return false;
  const name = brand.name;
  const optedIn = u.protect_opt_in_at !== null;
  const link = optedIn ? 'https://emera.social/?ref=welcome-email' : 'https://emera.social/protect?optin=1&ref=welcome-email';
  const subject = optedIn ? `You're protected on ${name}` : `Turn on free protection on ${name}`;
  const line = optedIn
    ? `You're protected on ${name}. Post your first thing and we start checking it for copies.`
    : `Turn on free protection and we check your newest posts for copies every month, takedowns included.`;
  if (deliveryFor(env) === 'log') {
    console.log(`[welcome] ${u.email}: ${subject} ${link}`);
    return true;
  }
  await postResend(env, {
    from: env.MAIL_FROM || `${name} <hello@emera.social>`,
    to: [u.email],
    subject,
    text: `${line}\n\n${link}`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111"><p>${line}</p><p><a href="${link}">${link}</a></p></div>`,
  });
  return true;
}
