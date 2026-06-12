'use client'

/**
 * Shared auth types + plan catalog for the web client.
 *
 * Authentication is real and server-side now: email + password with an
 * HTTP-only session cookie (see app/api/auth/* and lib/server/*). The client
 * never sees password hashes or session tokens — it talks to those routes and
 * reads the current account from /api/auth/me. Billing is real Stripe Checkout
 * (app/api/billing/*).
 */

export type PlanId = 'free' | 'pro' | 'max'

export interface Plan {
  id: PlanId
  name: string
  price: string
  period: string
  tagline: string
  features: string[]
  highlight?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'Cost-optimized routing on a daily budget.',
    features: ['Smart model routing', '$1.00 daily budget', 'Web & data tools', 'Image understanding'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$20',
    period: '/month',
    tagline: 'More budget and premium models when they earn it.',
    features: [
      'Everything in Free',
      '$25 monthly budget',
      'Premium models (Opus, GPT-5.3)',
      'Priority routing',
      'Unlimited conversations',
    ],
    highlight: true,
  },
  {
    id: 'max',
    name: 'Max',
    price: '$100',
    period: '/month',
    tagline: 'Highest budget and quality floor for heavy use.',
    features: ['Everything in Pro', '$150 monthly budget', 'Highest quality floor', 'Early access features'],
  },
]

export const planById = (id: PlanId | undefined): Plan => PLANS.find((p) => p.id === id) ?? PLANS[0]

export interface User {
  id: string
  email: string
  name: string | null
  plan: PlanId
  role: 'user' | 'admin'
  subscriptionStatus: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isValidEmail = (e: string) => EMAIL_RE.test(e.trim())
