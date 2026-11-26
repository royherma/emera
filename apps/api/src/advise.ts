import { Hono } from 'hono';
import type { AppEnv } from './env';
import { readJson } from './http';
import { hmacHex } from './crypto';

export type Kind = 'repost' | 'fake' | 'merch' | 'ai' | 'song' | 'other';
export type Answers = {
  kind: Kind;
  where: 'us' | 'other';
  registered: 'yes' | 'no' | 'unsure';
  madeMoney: 'yes' | 'no' | 'unsure';
  posts: 'few' | 'weekly' | 'daily';
};
export type Route = { id: string; title: string; cost: string; time: string; outcome: string; href: string; why: string };
export type Advice = { routes: Route[]; plan: { id: 'free' | 'creator' | 'pro'; title: string; why: string }; summary: string; ai: boolean };

const KINDS: Kind[] = ['repost', 'fake', 'merch', 'ai', 'song', 'other'];
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const PER_HOUR = 20;
const rate = new Map<string, number[]>();

const ROUTES: Record<string, Omit<Route, 'why'>> = {
  takedown: { id: 'takedown', title: 'Free takedown notice', cost: '$0', time: 'Usually days', outcome: 'The copy comes down', href: '/tools/takedown-notice/' },
  impersonation: { id: 'impersonation', title: 'Impersonation report', cost: '$0', time: 'Usually days', outcome: 'The fake account is removed', href: '/answers/fake-account-using-my-name/' },
  claim: { id: 'claim', title: 'Get paid: claim letter', cost: '$0 upfront, no win no fee', time: 'Weeks', outcome: 'They pay what they owe', href: '/protect/#paid' },
  register: { id: 'register', title: 'Register the work in the US', cost: '$45 to $65 per filing', time: 'Filed in minutes', outcome: 'Unlocks statutory damages and court', href: '/answers/how-to-register-copyright-us/' },
  ccb: { id: 'ccb', title: 'Copyright Claims Board', cost: '$100 filing fee', time: 'Months', outcome: 'Up to $30,000 per case', href: '/answers/copyright-small-claims-court/' },
  court: { id: 'court', title: 'Partner copyright lawyer', cost: 'No win, no fee', time: 'Months to a year', outcome: '$750 to $150,000 per work when registered in time', href: '/protect/#paid' },
  optout: { id: 'optout', title: 'Stop AI training on your work', cost: '$0', time: 'Minutes', outcome: 'Future training opt-outs filed', href: '/tools/ai-opt-out/' },
};

export function routesFor(a: Answers): Route[] {
  const out: Route[] = [];
  const add = (id: string, why: string) => out.push({ ...ROUTES[id], why });
  const money = a.madeMoney === 'yes';
  const us = a.where === 'us';
  if (a.kind === 'fake') add('impersonation', 'A fake account is handled fastest under the app\'s impersonation rules, free.');
  if (a.kind !== 'fake' || money) add('takedown', 'Getting the copy down is free and is the step every other route starts from.');
  if (a.kind === 'ai') add('optout', 'Opt-outs stop future training; the takedown handles outputs that copy your specific work.');
  if (money || a.madeMoney === 'unsure') add('claim', 'They earned from your work, so a claim letter is the cheapest way to get paid; most cases settle here.');
  if (us && money && a.registered !== 'yes') add('register', 'In the US you need registration before a court or the claims board will hear it, and it raises what you can win.');
  if (us && money) add('ccb', 'For claims under $30,000 against a US copier, the claims board costs $100 and needs no lawyer.');
  if (us && money && a.registered === 'yes') add('court', 'Registered in time means statutory damages, so a lawyer can take it on no win, no fee.');
  return out;
}

export function planFor(a: Answers): Advice['plan'] {
  if (a.posts === 'daily' || a.kind === 'fake') return { id: 'pro', title: 'Pro, $100 a month', why: a.kind === 'fake' ? 'Pro watches for new accounts using your name or face.' : 'You post daily, and Pro checks every new post daily.' };
  if (a.posts === 'weekly' || a.madeMoney === 'yes') return { id: 'creator', title: 'Creator, $10 a month', why: 'Weekly checks of up to 100 posts, and you keep 80% of what we recover instead of half.' };
  return { id: 'free', title: 'Free protection', why: 'Your 10 newest posts checked every month, takedowns included; recovered money is split 50/50.' };
}

function parse(body: Record<string, unknown>): Answers {
  const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);
  const kind = pick(body.kind, KINDS, 'other');
  return {
    kind,
    where: pick(body.where, ['us', 'other'] as const, 'us'),
    registered: pick(body.registered, ['yes', 'no', 'unsure'] as const, 'unsure'),
    madeMoney: pick(body.madeMoney, ['yes', 'no', 'unsure'] as const, 'unsure'),
    posts: pick(body.posts, ['few', 'weekly', 'daily'] as const, 'few'),
  };
}

const template = (routes: Route[], plan: Advice['plan']) =>
  `Start with ${routes[0].title.toLowerCase()} (${routes[0].cost}). ${routes[0].why}${routes[1] ? ` Then ${routes[1].title.toLowerCase()}.` : ''} Best plan for you: ${plan.title}.`;

async function aiSummary(env: AppEnv['Bindings'], a: Answers, routes: Route[], plan: Advice['plan']): Promise<string | null> {
  if (!env.AI) return null;
  const facts = routes.map((r, i) => `${i + 1}. ${r.title} - cost ${r.cost}, time ${r.time}, result ${r.outcome}. ${r.why}`).join('\n');
  const prompt = `A creator's work was copied. Situation: kind=${a.kind}, country=${a.where}, registered=${a.registered}, copier made money=${a.madeMoney}, posts=${a.posts}.\nRanked routes (cheapest that works first, do not reorder or add any):\n${facts}\nRecommended plan: ${plan.title} - ${plan.why}\nTalk to the creator directly as "you". Write 2 or 3 short plain sentences telling them what to do first and why, using only the facts above. No legal advice disclaimers, no dashes, no lists.`;
  try {
    const r = (await Promise.race([
      env.AI.run(MODEL, { messages: [{ role: 'user', content: prompt }], max_tokens: 160, temperature: 0.2 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
    ])) as { response?: string };
    const text = (r?.response || '').replace(/[—–]/g, ',').trim();
    return text.length > 20 && text.length < 700 ? text : null;
  } catch (e) {
    console.log('[advise] ai_failed', String(e));
    return null;
  }
}

export const adviseRoutes = new Hono<AppEnv>();

adviseRoutes.post('/v1/protect/advise', async (c) => {
  const body = await readJson(c);
  const a = parse(body);
  const key = await hmacHex(c.env.PROOF_SECRET || 'dev', `advise:${c.req.header('CF-Connecting-IP') ?? 'local'}`);
  const now = Date.now();
  const hits = (rate.get(key) || []).filter((t) => t > now - 3_600_000);
  if (rate.size > 5000) rate.clear();
  const useAi = hits.length < PER_HOUR;
  hits.push(now);
  rate.set(key, hits);
  const routes = routesFor(a);
  const plan = planFor(a);
  const text = useAi ? await aiSummary(c.env, a, routes, plan) : null;
  console.log(`[advise] ${JSON.stringify({ ...a, routes: routes.map((r) => r.id), plan: plan.id, ai: !!text })}`);
  return c.json({ routes, plan, summary: text || template(routes, plan), ai: !!text } satisfies Advice);
});
