import { generateObject } from 'ai'
import z from 'zod/v3'
import { gateway } from './gateway'

const planSchema = z.object({
  summary: z
    .string()
    .describe('One sentence describing what will be built'),
  phases: z
    .array(
      z.object({
        id: z.string().describe('Short slug, e.g. "create-sandbox"'),
        title: z.string().describe('2-4 word phase name'),
        description: z.string().describe('One short sentence'),
      })
    )
    .min(2)
    .max(5),
})

export type ConductorPlanData = z.infer<typeof planSchema>

const SYSTEM = `You are the planning conductor for a live coding platform. Given a user's build request, output a concise execution plan.

Rules:
- 3-5 phases only
- phase id: kebab-case slug
- phase title: 2-4 words
- phase description: one short sentence (what happens, not why)
- summary: one sentence describing what will be delivered

Standard phases (adapt as needed):
- Create Sandbox → spin up an isolated execution environment
- Generate Code → write all source files for the application
- Install Dependencies → install packages with pnpm
- Start Dev Server → launch the application
- Get Preview URL → expose a live public URL`

export async function runConductor(
  userMessage: string
): Promise<ConductorPlanData | null> {
  try {
    const { object } = await generateObject({
      model: gateway('anthropic/claude-sonnet-4.6'),
      schema: planSchema,
      system: SYSTEM,
      prompt: userMessage,
      headers: { 'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14' },
    })
    return object
  } catch (err) {
    console.error('[conductor] planning failed:', err)
    return null
  }
}
