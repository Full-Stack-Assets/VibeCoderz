# Conductor — Routing Benchmark

Comparison of the **COO router** against pin-one-model baselines over a 30-task golden set spanning coding, reasoning, writing, analysis, research, data, and vision. Cost is computed with the engine's own token pricing; quality comes from the `live-judge(anthropic/claude-opus-4.6)` oracle.

| Strategy | Avg quality | Total cost | $ / task | Quality / $ |
| --- | ---: | ---: | ---: | ---: |
| COO (this router) | 45.1% | $0.23752 | $0.00792 | 56.96 |
| Always-Premium (Opus) | 55.7% | $0.77138 | $0.02571 | 21.66 |
| Always-Balanced (Sonnet) | 56.9% | $0.46282 | $0.01543 | 36.88 |
| Always-Cheapest (Grok) | 51.4% | $0.06178 | $0.00206 | 249.61 |
| Quality-Oracle (upper bound) | 64.6% | $0.50300 | $0.01677 | 38.55 |

## Headline

- **vs Always-Premium (Opus):** 69.2% cheaper while retaining 81% of its quality.
- **vs Always-Cheapest (Grok):** 12.3% lower quality for 284.5% more spend.
- **vs Quality-Oracle (best achievable):** COO reaches 69.8% of the best-possible quality — at a fraction of the premium cost.

## Where routing wins (per domain)

| Domain | Tasks | COO quality | Premium quality | Retention | COO $ / task | Models COO used |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| coding | 6 | 62.7% | 71.3% | 87.9% | $0.00858 | openai/gpt-5.3-codex, google/gemini-2.5-pro |
| reasoning | 5 | 24.0% | 62.4% | 38.5% | $0.00987 | google/gemini-2.5-pro, openai/gpt-5.3-codex |
| writing | 5 | 86.4% | 84.8% | 101.9% | $0.01542 | anthropic/claude-sonnet-4.6 |
| analysis | 4 | 23.5% | 45.5% | 51.6% | $0.00411 | xai/grok-4.1-fast-reasoning, google/gemini-2.5-pro |
| research | 4 | 39.0% | 50.2% | 77.6% | $0.00206 | xai/grok-4.1-fast-reasoning |
| data | 3 | 36.7% | 36.3% | 100.9% | $0.00206 | xai/grok-4.1-fast-reasoning |
| vision | 3 | 21.7% | 5.0% | 433.3% | $0.00958 | google/gemini-2.5-pro, openai/gpt-5.3-codex |

## How COO routed each task

| Task | Domain | Routed model | Cost | Quality |
| --- | --- | --- | ---: | ---: |
| code-easy-1 | coding | openai/gpt-5.3-codex | $0.00822 | 82.0% |
| code-easy-2 | coding | openai/gpt-5.3-codex | $0.00823 | 75.0% |
| code-mid-1 | coding | openai/gpt-5.3-codex | $0.00823 | 85.0% |
| code-mid-2 | coding | openai/gpt-5.3-codex | $0.00824 | 42.0% |
| code-hard-1 | coding | openai/gpt-5.3-codex | $0.00825 | 82.0% |
| code-hard-2 | coding | google/gemini-2.5-pro | $0.01027 | 10.0% |
| reason-easy-1 | reasoning | google/gemini-2.5-pro | $0.01026 | 25.0% |
| reason-mid-1 | reasoning | google/gemini-2.5-pro | $0.01027 | 10.0% |
| reason-mid-2 | reasoning | openai/gpt-5.3-codex | $0.00824 | 72.0% |
| reason-hard-1 | reasoning | google/gemini-2.5-pro | $0.01028 | 8.0% |
| reason-hard-2 | reasoning | google/gemini-2.5-pro | $0.01028 | 5.0% |
| write-easy-1 | writing | anthropic/claude-sonnet-4.6 | $0.01541 | 90.0% |
| write-easy-2 | writing | anthropic/claude-sonnet-4.6 | $0.01540 | 90.0% |
| write-mid-1 | writing | anthropic/claude-sonnet-4.6 | $0.01543 | 82.0% |
| write-mid-2 | writing | anthropic/claude-sonnet-4.6 | $0.01544 | 82.0% |
| write-hard-1 | writing | anthropic/claude-sonnet-4.6 | $0.01545 | 88.0% |
| analysis-easy-1 | analysis | xai/grok-4.1-fast-reasoning | $0.00206 | 42.0% |
| analysis-mid-1 | analysis | xai/grok-4.1-fast-reasoning | $0.00206 | 12.0% |
| analysis-mid-2 | analysis | xai/grok-4.1-fast-reasoning | $0.00206 | 35.0% |
| analysis-hard-1 | analysis | google/gemini-2.5-pro | $0.01027 | 5.0% |
| research-easy-1 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 18.0% |
| research-mid-1 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 48.0% |
| research-mid-2 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 48.0% |
| research-hard-1 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 42.0% |
| data-easy-1 | data | xai/grok-4.1-fast-reasoning | $0.00206 | 52.0% |
| data-mid-1 | data | xai/grok-4.1-fast-reasoning | $0.00206 | 28.0% |
| data-hard-1 | data | xai/grok-4.1-fast-reasoning | $0.00206 | 30.0% |
| vision-easy-1 | vision | google/gemini-2.5-pro | $0.01025 | 12.0% |
| vision-mid-1 | vision | openai/gpt-5.3-codex | $0.00822 | 45.0% |
| vision-hard-1 | vision | google/gemini-2.5-pro | $0.01026 | 8.0% |

## Method & honesty notes

- The `COO` row calls the **shipping** `routeTurn` — this benchmarks the real router, not a reimplementation.
- **Cost** uses `estimateTurnCostUSD` with the catalog pricing the product meters with.
- **Quality** is the `live-judge(anthropic/claude-opus-4.6)` oracle: real model completions scored by an LLM judge on a 0–100 rubric. These are point-in-time live measurements (real model outputs + judge), not bit-for-bit reproducible. Run `pnpm eval` without `--live` to use the deterministic `synthetic` prior in CI — the strategies, dataset, and this report do not change.
- Regenerate with `pnpm eval` (add `--write` to update this file).

