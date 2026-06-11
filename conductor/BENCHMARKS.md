# Conductor — Routing Benchmark

Comparison of the **COO router** against pin-one-model baselines over a 30-task golden set spanning coding, reasoning, writing, analysis, research, data, and vision. Cost is computed with the engine's own token pricing; quality comes from the `synthetic` oracle.

| Strategy | Avg quality | Total cost | $ / task | Quality / $ |
| --- | ---: | ---: | ---: | ---: |
| COO (this router) | 98.2% | $0.26826 | $0.00894 | 109.85 |
| Always-Premium (Opus) | 98.7% | $0.77138 | $0.02571 | 38.38 |
| Always-Balanced (Sonnet) | 97.5% | $0.46282 | $0.01543 | 63.2 |
| Always-Cheapest (Grok) | 89.1% | $0.06171 | $0.00206 | 433.25 |
| Quality-Oracle (upper bound) | 98.7% | $0.74048 | $0.02468 | 39.99 |

## Headline

- **vs Always-Premium (Opus):** 65.2% cheaper while retaining 99.5% of its quality.
- **vs Always-Cheapest (Grok):** 10.2% higher quality for 334.7% more spend.
- **vs Quality-Oracle (best achievable):** COO reaches 99.5% of the best-possible quality — at a fraction of the premium cost.

## Where routing wins (per domain)

| Domain | Tasks | COO quality | Premium quality | Retention | COO $ / task | Models COO used |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| coding | 6 | 97.4% | 97.6% | 99.8% | $0.01063 | openai/gpt-5.5-codex, google/gemini-3-pro |
| reasoning | 5 | 97.6% | 98.2% | 99.3% | $0.01192 | google/gemini-3-pro, openai/gpt-5.5-codex |
| writing | 5 | 99.0% | 99.1% | 99.8% | $0.01542 | anthropic/claude-sonnet-4.6 |
| analysis | 4 | 98.5% | 98.9% | 99.6% | $0.00462 | xai/grok-4.3-fast-reasoning, google/gemini-3-pro |
| research | 4 | 98.9% | 99.4% | 99.5% | $0.00206 | xai/grok-4.3-fast-reasoning |
| data | 3 | 97.6% | 98.7% | 98.9% | $0.00206 | xai/grok-4.3-fast-reasoning |
| vision | 3 | 99.1% | 99.6% | 99.5% | $0.01163 | google/gemini-3-pro, openai/gpt-5.5-codex |

## How COO routed each task

| Task | Domain | Routed model | Cost | Quality |
| --- | --- | --- | ---: | ---: |
| code-easy-1 | coding | openai/gpt-5.5-codex | $0.01027 | 100.0% |
| code-easy-2 | coding | openai/gpt-5.5-codex | $0.01028 | 100.0% |
| code-mid-1 | coding | openai/gpt-5.5-codex | $0.01028 | 100.0% |
| code-mid-2 | coding | openai/gpt-5.5-codex | $0.01029 | 100.0% |
| code-hard-1 | coding | openai/gpt-5.5-codex | $0.01030 | 94.0% |
| code-hard-2 | coding | google/gemini-3-pro | $0.01233 | 90.4% |
| reason-easy-1 | reasoning | google/gemini-3-pro | $0.01232 | 100.0% |
| reason-mid-1 | reasoning | google/gemini-3-pro | $0.01232 | 100.0% |
| reason-mid-2 | reasoning | openai/gpt-5.5-codex | $0.01029 | 100.0% |
| reason-hard-1 | reasoning | google/gemini-3-pro | $0.01234 | 93.2% |
| reason-hard-2 | reasoning | google/gemini-3-pro | $0.01233 | 94.8% |
| write-easy-1 | writing | anthropic/claude-sonnet-4.6 | $0.01541 | 100.0% |
| write-easy-2 | writing | anthropic/claude-sonnet-4.6 | $0.01540 | 100.0% |
| write-mid-1 | writing | anthropic/claude-sonnet-4.6 | $0.01543 | 100.0% |
| write-mid-2 | writing | anthropic/claude-sonnet-4.6 | $0.01544 | 100.0% |
| write-hard-1 | writing | anthropic/claude-sonnet-4.6 | $0.01545 | 94.8% |
| analysis-easy-1 | analysis | xai/grok-4.3-fast-reasoning | $0.00206 | 100.0% |
| analysis-mid-1 | analysis | xai/grok-4.3-fast-reasoning | $0.00206 | 100.0% |
| analysis-mid-2 | analysis | xai/grok-4.3-fast-reasoning | $0.00206 | 100.0% |
| analysis-hard-1 | analysis | google/gemini-3-pro | $0.01233 | 94.0% |
| research-easy-1 | research | xai/grok-4.3-fast-reasoning | $0.00205 | 100.0% |
| research-mid-1 | research | xai/grok-4.3-fast-reasoning | $0.00206 | 100.0% |
| research-mid-2 | research | xai/grok-4.3-fast-reasoning | $0.00206 | 100.0% |
| research-hard-1 | research | xai/grok-4.3-fast-reasoning | $0.00206 | 95.6% |
| data-easy-1 | data | xai/grok-4.3-fast-reasoning | $0.00206 | 100.0% |
| data-mid-1 | data | xai/grok-4.3-fast-reasoning | $0.00206 | 98.8% |
| data-hard-1 | data | xai/grok-4.3-fast-reasoning | $0.00206 | 94.0% |
| vision-easy-1 | vision | google/gemini-3-pro | $0.01230 | 100.0% |
| vision-mid-1 | vision | openai/gpt-5.5-codex | $0.01027 | 100.0% |
| vision-hard-1 | vision | google/gemini-3-pro | $0.01232 | 97.2% |

## Method & honesty notes

- The `COO` row calls the **shipping** `routeTurn` — this benchmarks the real router, not a reimplementation.
- **Cost** uses `estimateTurnCostUSD` with the catalog pricing the product meters with.
- **Quality** is the `synthetic` oracle: a transparent prior (capability vs task difficulty, specialty match, vision capability), not a live measurement. It exists so the harness runs deterministically in CI. Swap in the **LLM-judge** oracle (`--live`, requires a gateway/provider key) to replace the prior with measured scores — the strategies, dataset, and this report do not change.
- Regenerate with `pnpm eval` (add `--write` to update this file).

