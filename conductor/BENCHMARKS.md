# Conductor — Routing Benchmark

Comparison of the **COO router** against pin-one-model baselines over a 30-task golden set spanning coding, reasoning, writing, analysis, research, data, and vision. Cost is computed with the engine's own token pricing; quality comes from the `synthetic` oracle.

| Strategy | Avg quality | Total cost | $ / task | Quality / $ |
| --- | ---: | ---: | ---: | ---: |
| COO (this router) | 97.8% | $0.23752 | $0.00792 | 123.51 |
| Always-Premium (Opus) | 98.6% | $0.77138 | $0.02571 | 38.33 |
| Always-Balanced (Sonnet) | 97.0% | $0.46282 | $0.01543 | 62.87 |
| Always-Cheapest (Grok) | 87.8% | $0.06178 | $0.00206 | 426.24 |
| Quality-Oracle (upper bound) | 98.6% | $0.77138 | $0.02571 | 38.33 |

## Headline

- **vs Always-Premium (Opus):** 69.2% cheaper while retaining 99.2% of its quality.
- **vs Always-Cheapest (Grok):** 11.4% higher quality for 284.5% more spend.
- **vs Quality-Oracle (best achievable):** COO reaches 99.2% of the best-possible quality — at a fraction of the premium cost.

## Where routing wins (per domain)

| Domain | Tasks | COO quality | Premium quality | Retention | COO $ / task | Models COO used |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| coding | 6 | 96.9% | 97.5% | 99.4% | $0.00858 | openai/gpt-5.3-codex, google/gemini-2.5-pro |
| reasoning | 5 | 97.2% | 98.1% | 99.1% | $0.00987 | google/gemini-2.5-pro, openai/gpt-5.3-codex |
| writing | 5 | 98.8% | 99.0% | 99.8% | $0.01542 | anthropic/claude-sonnet-4.6 |
| analysis | 4 | 98.2% | 98.8% | 99.4% | $0.00411 | xai/grok-4.1-fast-reasoning, google/gemini-2.5-pro |
| research | 4 | 98.4% | 99.3% | 99.1% | $0.00206 | xai/grok-4.1-fast-reasoning |
| data | 3 | 96.5% | 98.5% | 98% | $0.00206 | xai/grok-4.1-fast-reasoning |
| vision | 3 | 98.8% | 99.5% | 99.3% | $0.00958 | google/gemini-2.5-pro, openai/gpt-5.3-codex |

## How COO routed each task

| Task | Domain | Routed model | Cost | Quality |
| --- | --- | --- | ---: | ---: |
| code-easy-1 | coding | openai/gpt-5.3-codex | $0.00822 | 100.0% |
| code-easy-2 | coding | openai/gpt-5.3-codex | $0.00823 | 100.0% |
| code-mid-1 | coding | openai/gpt-5.3-codex | $0.00823 | 100.0% |
| code-mid-2 | coding | openai/gpt-5.3-codex | $0.00824 | 100.0% |
| code-hard-1 | coding | openai/gpt-5.3-codex | $0.00825 | 92.8% |
| code-hard-2 | coding | google/gemini-2.5-pro | $0.01027 | 88.4% |
| reason-easy-1 | reasoning | google/gemini-2.5-pro | $0.01026 | 100.0% |
| reason-mid-1 | reasoning | google/gemini-2.5-pro | $0.01027 | 100.0% |
| reason-mid-2 | reasoning | openai/gpt-5.3-codex | $0.00824 | 99.6% |
| reason-hard-1 | reasoning | google/gemini-2.5-pro | $0.01028 | 92.4% |
| reason-hard-2 | reasoning | google/gemini-2.5-pro | $0.01028 | 94.0% |
| write-easy-1 | writing | anthropic/claude-sonnet-4.6 | $0.01541 | 100.0% |
| write-easy-2 | writing | anthropic/claude-sonnet-4.6 | $0.01540 | 100.0% |
| write-mid-1 | writing | anthropic/claude-sonnet-4.6 | $0.01543 | 100.0% |
| write-mid-2 | writing | anthropic/claude-sonnet-4.6 | $0.01544 | 100.0% |
| write-hard-1 | writing | anthropic/claude-sonnet-4.6 | $0.01545 | 94.0% |
| analysis-easy-1 | analysis | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| analysis-mid-1 | analysis | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| analysis-mid-2 | analysis | xai/grok-4.1-fast-reasoning | $0.00206 | 99.6% |
| analysis-hard-1 | analysis | google/gemini-2.5-pro | $0.01027 | 93.2% |
| research-easy-1 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| research-mid-1 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| research-mid-2 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 99.6% |
| research-hard-1 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 94.0% |
| data-easy-1 | data | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| data-mid-1 | data | xai/grok-4.1-fast-reasoning | $0.00206 | 97.2% |
| data-hard-1 | data | xai/grok-4.1-fast-reasoning | $0.00206 | 92.4% |
| vision-easy-1 | vision | google/gemini-2.5-pro | $0.01025 | 100.0% |
| vision-mid-1 | vision | openai/gpt-5.3-codex | $0.00822 | 100.0% |
| vision-hard-1 | vision | google/gemini-2.5-pro | $0.01026 | 96.4% |

## Method & honesty notes

- The `COO` row calls the **shipping** `routeTurn` — this benchmarks the real router, not a reimplementation.
- **Cost** uses `estimateTurnCostUSD` with the catalog pricing the product meters with.
- **Quality** is currently the `synthetic` oracle: a transparent prior (capability vs task difficulty, specialty match, vision capability), not a live measurement. It exists so the harness runs deterministically in CI. Swap in the **LLM-judge** oracle (`--live`, requires a gateway/provider key) to replace the prior with measured scores — the strategies, dataset, and this report do not change.
- Regenerate with `pnpm eval` (add `--write` to update this file).

