import { type ChatUIMessage } from '@/components/chat/types'
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from 'ai'
import { DEFAULT_MODEL, MODEL_NAMES, SUPPORTED_MODELS } from '@/ai/constants'
import { NextResponse } from 'next/server'
import { getModelOptions } from '@/ai/gateway'
import { checkBotId } from 'botid/server'
import { tools } from '@/ai/tools'
import { getSessionUser } from '@/lib/auth'
import { getDb, schema } from '@/db/client'
import { eq } from 'drizzle-orm'
import { BILLING_ENABLED, creditsForUsage } from '@/lib/billing'
import { deductCredits } from '@/lib/credits'
import { runConductor } from '@/ai/conductor'
import prompt from './prompt.md'

// Agentic generation streams for minutes (model turns + sandbox tool loops),
// far past the default serverless function ceiling. Raise the limit so runs
// aren't truncated mid-stream. The platform clamps this to the plan's maximum
// (e.g. 300s on Vercel Pro, higher with Fluid Compute).
export const maxDuration = 300

interface BodyData {
  messages: ChatUIMessage[]
  modelId?: string
  reasoningEffort?: 'low' | 'medium'
}

export async function POST(req: Request) {
  const [checkResult, { messages, modelId = DEFAULT_MODEL, reasoningEffort }] =
    await Promise.all([checkBotId(), req.json() as Promise<BodyData>])

  if (checkResult.isBot) {
    return NextResponse.json({ error: `Bot detected` }, { status: 403 })
  }

  if (!SUPPORTED_MODELS.includes(modelId)) {
    return NextResponse.json(
      { error: `Model ${modelId} not found.` },
      { status: 400 }
    )
  }

  // Auth + credit gating is opt-in via NEXT_PUBLIC_BILLING_ENABLED. When off,
  // the app is usable anonymously with no metering.
  let userId: string | null = null
  if (BILLING_ENABLED) {
    const session = await getSessionUser()
    if (!session) {
      return NextResponse.json(
        { error: 'Please sign in to start building.' },
        { status: 401 }
      )
    }

    const db = await getDb()
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, session.sub),
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Please sign in to start building.' },
        { status: 401 }
      )
    }

    if (user.creditsBalance <= 0) {
      return NextResponse.json(
        { error: "You're out of credits. Add more to keep building." },
        { status: 402 }
      )
    }

    userId = user.id
  }

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => {
        // Run the conductor only on the opening user message (no prior
        // assistant turn yet), so it produces a plan before the worker
        // starts executing tools.
        const userMessages = messages.filter((m) => m.role === 'user')
        if (userMessages.length === 1) {
          const firstUserText = userMessages[0].parts
            .filter((p) => p.type === 'text')
            .map((p) => (p as { type: 'text'; text: string }).text)
            .join(' ')

          if (firstUserText.trim()) {
            const plan = await runConductor(firstUserText)
            if (plan) {
              writer.write({
                type: 'data-conductor-plan',
                data: plan,
              })
            }
          }
        }

        const result = streamText({
          ...getModelOptions(modelId, { reasoningEffort }),
          system: prompt,
          messages: await convertToModelMessages(
            messages.map((message) => {
              message.parts = message.parts.map((part) => {
                if (part.type === 'data-report-errors') {
                  return {
                    type: 'text',
                    text:
                      `There are errors in the generated code. This is the summary of the errors we have:\n` +
                      `\`\`\`${part.data.summary}\`\`\`\n` +
                      (part.data.paths?.length
                        ? `The following files may contain errors:\n` +
                          `\`\`\`${part.data.paths?.join('\n')}\`\`\`\n`
                        : '') +
                      `Fix the errors reported.`,
                  }
                }
                return part
              })
              return message
            })
          ),
          stopWhen: stepCountIs(20),
          tools: tools({ modelId, writer }),
          onFinish: async ({ totalUsage }) => {
            if (!userId) return
            try {
              const credits = creditsForUsage(modelId, {
                inputTokens: totalUsage.inputTokens,
                outputTokens: totalUsage.outputTokens,
                cachedInputTokens: totalUsage.cachedInputTokens,
              })
              await deductCredits(userId, credits, 'generation')
            } catch (error) {
              console.error('Failed to deduct credits:', error)
            }
          },
          onError: (error) => {
            console.error('Error communicating with AI')
            console.error(JSON.stringify(error, null, 2))
          },
        })
        result.consumeStream()
        writer.merge(
          result.toUIMessageStream({
            sendReasoning: true,
            sendStart: false,
            messageMetadata: () => ({
              model: MODEL_NAMES[modelId] ?? modelId,
            }),
          })
        )
      },
    }),
  });
}
