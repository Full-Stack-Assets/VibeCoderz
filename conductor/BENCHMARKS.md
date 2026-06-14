# Conductor — Routing Benchmark

Comparison of the **COO router** against pin-one-model baselines over a 52-task golden set spanning coding, reasoning, writing, analysis, research, data, and vision. Cost is computed with the engine's own token pricing; quality comes from the `synthetic` oracle.

| Strategy | Avg quality | Total cost | $ / task | Quality / $ |
| --- | ---: | ---: | ---: | ---: |
| COO (this router) | 98.2% | $0.46872 | $0.00901 | 108.99 |
| Always-Premium (Opus) | 98.7% | $1.33727 | $0.02572 | 38.37 |
| Always-Balanced (Sonnet) | 97.5% | $0.80236 | $0.01543 | 63.19 |
| Always-Cheapest (Grok) | 88.1% | $0.10698 | $0.00206 | 428.11 |
| Quality-Oracle (upper bound) | 98.7% | $1.29094 | $0.02483 | 39.75 |

## Headline

- **vs Always-Premium (Opus):** 64.9% cheaper while retaining 99.6% of its quality.
- **vs Always-Cheapest (Grok):** 11.5% higher quality for 338.1% more spend.
- **vs Quality-Oracle (best achievable):** COO reaches 99.5% of the best-possible quality — at a fraction of the premium cost.

## Where routing wins (per domain)

| Domain | Tasks | COO quality | Premium quality | Retention | COO $ / task | Models COO used |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| coding | 9 | 97.6% | 97.7% | 99.9% | $0.01051 | openai/gpt-5.3-codex, google/gemini-3.1-pro-preview |
| reasoning | 8 | 97.8% | 98.4% | 99.4% | $0.01079 | google/gemini-3.1-pro-preview, openai/gpt-5.3-codex, xai/grok-4.1-fast-reasoning |
| writing | 8 | 98.8% | 99.0% | 99.8% | $0.01414 | anthropic/claude-sonnet-4.6, openai/gpt-5.3-codex |
| analysis | 7 | 98.2% | 98.7% | 99.5% | $0.00793 | xai/grok-4.1-fast-reasoning, google/gemini-3.1-pro-preview |
| research | 7 | 98.6% | 99.2% | 99.4% | $0.00206 | xai/grok-4.1-fast-reasoning |
| data | 7 | 98.1% | 98.7% | 99.3% | $0.00470 | xai/grok-4.1-fast-reasoning, openai/gpt-5.3-codex, google/gemini-3.1-pro-preview |
| vision | 6 | 98.9% | 99.5% | 99.5% | $0.01198 | google/gemini-3.1-pro-preview, openai/gpt-5.3-codex |

## How COO routed each task

| Task | Domain | Routed model | Cost | Quality |
| --- | --- | --- | ---: | ---: |
| code-easy-1 | coding | openai/gpt-5.3-codex | $0.01027 | 100.0% |
| code-easy-2 | coding | openai/gpt-5.3-codex | $0.01028 | 100.0% |
| code-mid-1 | coding | openai/gpt-5.3-codex | $0.01028 | 100.0% |
| code-mid-2 | coding | openai/gpt-5.3-codex | $0.01029 | 100.0% |
| code-hard-1 | coding | openai/gpt-5.3-codex | $0.01030 | 94.0% |
| code-hard-2 | coding | google/gemini-3.1-pro-preview | $0.01233 | 90.4% |
| reason-easy-1 | reasoning | google/gemini-3.1-pro-preview | $0.01232 | 100.0% |
| reason-mid-1 | reasoning | google/gemini-3.1-pro-preview | $0.01232 | 100.0% |
| reason-mid-2 | reasoning | openai/gpt-5.3-codex | $0.01029 | 100.0% |
| reason-hard-1 | reasoning | google/gemini-3.1-pro-preview | $0.01234 | 93.2% |
| reason-hard-2 | reasoning | google/gemini-3.1-pro-preview | $0.01233 | 94.8% |
| write-easy-1 | writing | anthropic/claude-sonnet-4.6 | $0.01541 | 100.0% |
| write-easy-2 | writing | anthropic/claude-sonnet-4.6 | $0.01540 | 100.0% |
| write-mid-1 | writing | anthropic/claude-sonnet-4.6 | $0.01543 | 100.0% |
| write-mid-2 | writing | anthropic/claude-sonnet-4.6 | $0.01544 | 100.0% |
| write-hard-1 | writing | anthropic/claude-sonnet-4.6 | $0.01545 | 94.8% |
| analysis-easy-1 | analysis | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| analysis-mid-1 | analysis | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| analysis-mid-2 | analysis | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| analysis-hard-1 | analysis | google/gemini-3.1-pro-preview | $0.01233 | 94.0% |
| research-easy-1 | research | xai/grok-4.1-fast-reasoning | $0.00205 | 100.0% |
| research-mid-1 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| research-mid-2 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| research-hard-1 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 95.6% |
| data-easy-1 | data | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| data-mid-1 | data | xai/grok-4.1-fast-reasoning | $0.00206 | 98.8% |
| data-hard-1 | data | xai/grok-4.1-fast-reasoning | $0.00206 | 94.0% |
| vision-easy-1 | vision | google/gemini-3.1-pro-preview | $0.01230 | 100.0% |
| vision-mid-1 | vision | openai/gpt-5.3-codex | $0.01027 | 100.0% |
| vision-hard-1 | vision | google/gemini-3.1-pro-preview | $0.01232 | 97.2% |
| code-mid-3 | coding | openai/gpt-5.3-codex | $0.01028 | 100.0% |
| code-mid-4 | coding | openai/gpt-5.3-codex | $0.01029 | 100.0% |
| code-hard-3 | coding | openai/gpt-5.3-codex | $0.01029 | 94.0% |
| reason-easy-2 | reasoning | google/gemini-3.1-pro-preview | $0.01232 | 100.0% |
| reason-mid-3 | reasoning | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| reason-hard-3 | reasoning | google/gemini-3.1-pro-preview | $0.01233 | 94.0% |
| write-easy-3 | writing | openai/gpt-5.3-codex | $0.01029 | 100.0% |
| write-mid-3 | writing | openai/gpt-5.3-codex | $0.01029 | 100.0% |
| write-hard-2 | writing | anthropic/claude-sonnet-4.6 | $0.01544 | 95.2% |
| analysis-easy-2 | analysis | google/gemini-3.1-pro-preview | $0.01233 | 100.0% |
| analysis-mid-3 | analysis | google/gemini-3.1-pro-preview | $0.01233 | 100.0% |
| analysis-hard-2 | analysis | google/gemini-3.1-pro-preview | $0.01233 | 93.6% |
| research-easy-2 | research | xai/grok-4.1-fast-reasoning | $0.00205 | 100.0% |
| research-mid-3 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| research-hard-2 | research | xai/grok-4.1-fast-reasoning | $0.00206 | 94.8% |
| data-easy-2 | data | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| data-mid-2 | data | openai/gpt-5.3-codex | $0.01029 | 100.0% |
| data-mid-3 | data | xai/grok-4.1-fast-reasoning | $0.00206 | 100.0% |
| data-hard-2 | data | google/gemini-3.1-pro-preview | $0.01233 | 93.6% |
| vision-easy-2 | vision | google/gemini-3.1-pro-preview | $0.01232 | 100.0% |
| vision-mid-2 | vision | google/gemini-3.1-pro-preview | $0.01232 | 100.0% |
| vision-hard-2 | vision | google/gemini-3.1-pro-preview | $0.01232 | 96.4% |

## Method & honesty notes

- The `COO` row calls the **shipping** `routeTurn` — this benchmarks the real router, not a reimplementation.
- **Cost** uses `estimateTurnCostUSD` with the catalog pricing the product meters with.
- **Quality** is the `synthetic` oracle: a transparent prior (capability vs task difficulty, specialty match, vision capability), not a live measurement. It exists so the harness runs deterministically in CI. Swap in the **LLM-judge** oracle (`--live`, requires a gateway/provider key) to replace the prior with measured scores — the strategies, dataset, and this report do not change.
- Regenerate with `pnpm eval` (add `--write` to update this file).

