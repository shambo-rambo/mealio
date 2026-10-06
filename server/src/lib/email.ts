import type { Bindings } from '../types.js'

/**
 * Sends transactional email through Resend (https://resend.com).
 * Without RESEND_API_KEY (local dev) the message is logged instead so flows stay testable.
 */
export async function sendEmail(env: Bindings, msg: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email:dev] to=${msg.to} subject="${msg.subject}"\n${msg.text}`)
    return false
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM ?? 'Food Prep <onboarding@resend.dev>', ...msg }),
  })
  if (!res.ok) console.error('[email] send failed', res.status, await res.text().catch(() => ''))
  return res.ok
}

export function resetEmail(name: string, link: string) {
  const first = name.split(' ')[0] || 'there'
  return {
    subject: 'Reset your Food Prep password',
    text: `Hi ${first},\n\nUse this link to choose a new password (valid for 1 hour):\n${link}\n\nIf you didn't ask for this, you can ignore this email — your password won't change.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1b1c1a">
<h2 style="margin:0 0 12px">Reset your password</h2>
<p>Hi ${first.replace(/[<>&"]/g, '')},</p>
<p>Tap the button to choose a new password. The link works for 1 hour.</p>
<p style="margin:24px 0"><a href="${link}" style="background:#096430;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Choose a new password</a></p>
<p style="color:#6b6b66;font-size:13px">If you didn't ask for this, ignore this email — your password won't change.</p></div>`,
  }
}
