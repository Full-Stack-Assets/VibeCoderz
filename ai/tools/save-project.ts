import { tool } from 'ai'
import z from 'zod/v3'
import { getDb, schema } from '@/db/client'

interface Params {
  userId: string
}

export const saveProjectTool = ({ userId }: Params) =>
  tool({
    description:
      'Save the generated project to the database for later retrieval and management.',
    inputSchema: z.object({
      name: z.string().describe('Project name'),
      description: z.string().optional().describe('Project description'),
      prompt: z.string().describe('Original user prompt that generated this project'),
      code: z.string().describe('Generated code/configuration'),
      sandboxId: z.string().optional().describe('Associated sandbox ID'),
      modelUsed: z.string().describe('Model used to generate the project'),
    }),
    execute: async ({ name, description, prompt, code, sandboxId, modelUsed }) => {
      try {
        const db = await getDb()
        const result = await db
          .insert(schema.projects)
          .values({
            userId, // stamp ownership so the project is scoped to its creator
            name,
            description,
            prompt,
            code,
            sandboxId,
            modelUsed,
            status: 'completed',
          })
          .returning()

        return {
          success: true,
          projectId: result[0].id,
          message: `Project "${name}" saved successfully`,
        }
      } catch (error) {
        console.error('Failed to save project:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    },
  })
