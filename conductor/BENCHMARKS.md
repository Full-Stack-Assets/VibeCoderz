# Conductor — Routing Benchmark

Comparison of the **COO router** against pin-one-model baselines over a 18-task golden set spanning coding, reasoning, writing, analysis, research, data, and vision. Cost is computed with the engine's own token pricing; quality comes from the `synthetic` oracle.

| Strategy | Avg quality | Total cost | $ / task | Quality / $ |
| --- | ---: | ---: | ---: | ---: |
| COO (this router) | 98.1% | $0.14910 | $0.00828 | 118.41 |
| Always-Premium (Opus) | 98.7% | $0.46286 | $0.02571 | 38.4 |
| Always-Balanced (Sonnet) | 97.1% | $0.27771 | $0.01543 | 62.93 |
| Always-Cheapest (Grok) | 86.9% | $0.03707 | $0.00206 | 422.13 |
| Quality-Oracle (upper bound) | 98.7% | $0.46286 | $0.02571 | 38.4 |

## Headline

- **vs Always-Premium (Opus):** 67.8% cheaper while retaining 99.4% of its quality.
- **vs Always-Cheapest (Grok):** 12.8% higher quality for 302.2% more spend.
- **vs Quality-Oracle (best achievable):** COO reaches 99.4% of the best-possible quality — at a fraction of the premium cost.

## How COO routed each task

| Task | Domain | Routed model | Cost | Quality |
| --- | --- | --- | ---: | ---: |
| code-easy-1 | coding | openai/gpt-5.3-codex | $0.00822 | 100.0% |
| code-mid-1 | coding | openai/gpt-5.3-codex | $0.00823 | 100.0% |
| code-mid-2 | coding | openai/gpt-5.3-codex | $0.00824 | 100.0% |
| code-hard-1 | coding | openai/gpt-5.3-codex | $0.00825 | 92.8% |
| reason-mid-1 | reasoning | google/gemini-2.5-pro | $0.01027 | 100.0% |
| reason-hard-1 | reasoning | google/gemini-2.5-pro | $0.01028 | 92.4% |
| reason-hard-2 | reasoning | google/gemini-2.5-pro | $0.01028 | 94.0% |
| write-easy-1 | writing | anthropic/claude-sonnet-4.6 | $0.01541 | 100.0% |
| write-mid-1 | writing | anthropic/claude-sonnet-4.6 | $0.01543 | 100.0% |
| write-mid-2 | writing | anthropic/claude-sonnet-4.6 | $0.01544 | 100.0% |
| analysis-mid-1 | analysis | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| analysis-hard-1 | analysis | google/gemini-2.5-pro | $0.01027 | 93.2% |
| research-mid-1 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| research-mid-2 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 99.6% |
| data-easy-1 | data | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| data-mid-1 | data | xai/grok-4.1-fast-reasoning | $0.00206 | 97.2% |
| vision-mid-1 | vision | openai/gpt-5.3-codex | $0.00822 | 100.0% |
| vision-hard-1 | vision | google/gemini-2.5-pro | $0.01026 | 96.4% |

## Method & honesty notes

- The `COO` row calls the **shipping** `routeTurn` — this benchmarks the real router, not a reimplementation.
- **Cost** uses `estimateTurnCostUSD` with the catalog pricing the product meters with.
- **Quality** is currently the `synthetic` oracle: a transparent prior (capability vs task difficulty, specialty match, vision capability), not a live measurement. It exists so the harness runs deterministically in CI. Swap in the **LLM-judge** oracle (`--live`, requires a gateway/provider key) to replace the prior with measured scores — the strategies, dataset, and this report do not change.
- Regenerate with `pnpm eval` (add `--write` to update this file).

