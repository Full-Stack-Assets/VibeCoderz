import type { InferUITools, UIMessage, UIMessageStreamWriter } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { createSandbox } from './create-sandbox'
import { generateFiles } from './generate-files'
import { getSandboxURL } from './get-sandbox-url'
import { runCommand } from './run-command'
import { pushToGithubTool } from './push-to-github'
import { saveProjectTool } from './save-project'

interface Params {
  modelId: string
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
  // The authenticated owner — sandboxes and saved projects are stamped with it
  // so the resource endpoints can authorize access.
  userId: string
}

export function tools({ modelId, writer, userId }: Params) {
  return {
    createSandbox: createSandbox({ writer, userId }),
    generateFiles: generateFiles({ writer, modelId }),
    getSandboxURL: getSandboxURL({ writer }),
    runCommand: runCommand({ writer }),
    pushToGithub: pushToGithubTool,
    saveProject: saveProjectTool({ userId }),
  }
}

export type ToolSet = InferUITools<ReturnType<typeof tools>>
