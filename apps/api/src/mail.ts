export const delivery: 'log' | 'resend' = 'log';

export async function sendCode(email: string, code: string): Promise<void> {
  console.log(`[auth] sign-in code for ${email}: ${code}`);
}
