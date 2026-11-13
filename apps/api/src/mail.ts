import type { Env } from './env';
import { BRAND as brand } from './brand';

export const deliveryFor = (env: Env): 'log' | 'resend' => (env.RESEND_API_KEY ? 'resend' : 'log');

export async function sendCode(env: Env, email: string, code: string): Promise<void> {
  if (deliveryFor(env) === 'log') {
    console.log(`[auth] sign-in code for ${email}: ${code}`);
    return;
  }
  const name = brand.name;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || `${name} <hello@emera.social>`,
      to: [email],
      subject: `${code} is your ${name} code`,
      text: `Your ${name} sign-in code is ${code}\n\nIt works for 10 minutes. If you didn't ask for it, you can ignore this email.`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111"><p>Your ${name} sign-in code</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:8px 0">${code}</p><p style="color:#666">It works for 10 minutes. If you didn't ask for it, you can ignore this email.</p></div>`,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
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
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || `${brand.name} <hello@emera.social>`,
      to: [env.REPORTS_TO],
      subject: `Copy report ${r.id}`,
      text,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
