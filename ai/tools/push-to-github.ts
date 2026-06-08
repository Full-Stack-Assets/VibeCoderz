import { tool } from 'ai'
import z from 'zod/v3'
import { Octokit } from 'octokit'

export const pushToGithubTool = tool({
  description:
    'Push the generated code to a GitHub repository. Creates a new repo if needed.',
  inputSchema: z.object({
    repoName: z.string().describe('Name of the GitHub repository'),
    description: z.string().describe('Description of the repository'),
    files: z
      .array(
        z.object({
          path: z.string().describe('File path relative to repo root'),
          content: z.string().describe('File content'),
        })
      )
      .describe('Files to commit to the repository'),
    isPrivate: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether the repository should be private'),
  }),
  execute: async ({ repoName, description, files, isPrivate }) => {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    })

    try {
      const user = await octokit.rest.users.getAuthenticated()
      const owner = user.data.login

      // Create repository
      let repo
      try {
        repo = await octokit.rest.repos.createForAuthenticatedUser({
          name: repoName,
          description,
          private: isPrivate,
          auto_init: true,
        })
      } catch (error: any) {
        if (error.status === 422) {
          // Repository already exists, get it
          repo = await octokit.rest.repos.get({
            owner,
            repo: repoName,
          })
        } else {
          throw error
        }
      }

      const branch = repo.data.default_branch || 'main'

      const ref = await octokit.rest.git.getRef({
        owner,
        repo: repoName,
        ref: `heads/${branch}`,
      })

      const commitSha = ref.data.object.sha

      const commit = await octokit.rest.git.getCommit({
        owner,
        repo: repoName,
        commit_sha: commitSha,
      })

      const baseTreeSha = commit.data.tree.sha

      const blobs = await Promise.all(
        files.map(async (file) => {
          const blob = await octokit.rest.git.createBlob({
            owner,
            repo: repoName,
            content: file.content,
            encoding: 'utf-8',
          })
          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.data.sha,
          }
        })
      )

      const tree = await octokit.rest.git.createTree({
        owner,
        repo: repoName,
        base_tree: baseTreeSha,
        tree: blobs,
      })

      const newCommit = await octokit.rest.git.createCommit({
        owner,
        repo: repoName,
        message: 'Initial commit from Vibe Coding Platform',
        tree: tree.data.sha,
        parents: [commitSha],
      })

      await octokit.rest.git.updateRef({
        owner,
        repo: repoName,
        ref: `heads/${branch}`,
        sha: newCommit.data.sha,
      })

      return {
        success: true,
        repoUrl: repo.data.html_url,
        cloneUrl: repo.data.clone_url,
      }
    } catch (error) {
      console.error('Failed to push to GitHub:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
})
