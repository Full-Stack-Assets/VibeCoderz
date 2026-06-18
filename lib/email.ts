/**
 * Minimal transactional email over the Resend REST API (no SDK dependency).
 *
 * Configure RESEND_API_KEY + AUTH_EMAIL_FROM to actually deliver. When the key
 * is absent (local dev / unconfigured), the message is logged to the server
 * console instead so the sign-in flow stays testable without an email provider.
 */

const RESEND_API = 'https://api.resend.com/emails'

interface LoginEmail {
  email: string
  code: string
  link: string
}

export async function sendLoginEmail({ email, code, link }: LoginEmail): Promise<void> {
  const subject = 'Your sign-in code'
  const text =
    `Your sign-in code is ${code}\n\n` +
    `Or sign in with this link (valid 10 minutes):\n${link}\n\n` +
    `If you didn't request this, you can safely ignore this email.`

  const key = process.env.RESEND_API_KEY
  if (!key) {
    // Unconfigured: surface the code/link in logs so dev can complete sign-in.
    console.log(`[email:dev] sign-in for ${email} → code ${code} · link ${link}`)
    return
  }

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject,
      text,
    }),
  })
  if (!res.ok) {
    throw new Error(`email send failed: ${res.status} ${await res.text().catch(() => '')}`)
  }
}
