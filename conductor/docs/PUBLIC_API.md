# Conductor Public API (v1)

Programmatic access to the COO router: send messages, get back the answer plus
which model was chosen, why, and what it cost. Usage is metered against your
plan budget — the same server-enforced cap as the web app.

## Authentication

Create a key in the app (it's shown **once**), then pass it as a Bearer token:

```
Authorization: Bearer sk_cond_xxxxxxxxxxxxxxxxxxxx
```

Keys are managed at `/api/keys` (session-authenticated, i.e. from the web app):

- `POST /api/keys` `{ "label": "my app" }` → `{ key, id, label }` (plaintext key returned once)
- `GET /api/keys` → `{ keys: [{ id, label, createdAt, lastUsedAt }] }`
- `DELETE /api/keys?id=<id>` → `{ ok }`

Only the SHA-256 hash of a key is stored; the plaintext is never persisted.

## Chat

`POST /api/v1/chat`

```bash
curl https://<host>/api/v1/chat \
  -H "Authorization: Bearer $CONDUCTOR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{ "role": "user", "content": "Explain optimistic vs pessimistic locking." }]
  }'
```

Request body:

| Field | Type | Notes |
| --- | --- | --- |
| `messages` | `{role, content}[]` | required; `role` ∈ `user`/`assistant`/`system` |
| `preferModel` | string | optional model pin (clamped to what your plan allows) |
| `qualityFloor` | number | optional 0..1 minimum capability |
| `escalate` | boolean | verify-and-escalate (default `true`); `false` for a single completion |

Response:

```json
{
  "text": "…",
  "model": { "id": "anthropic/claude-sonnet-4.6", "label": "Claude Sonnet 4.6" },
  "routing": { "score": 0.82, "domain": "reasoning", "sensitive": null, "reason": "optimal match: …" },
  "escalation": { "evaluated": true, "escalated": false, "score": 0.78 },
  "costUSD": 0.0123,
  "simulated": false
}
```

Status codes: `401` invalid/missing key, `402` plan budget exhausted, `400` bad request.

> **Scaffold status:** v1 is a single-turn JSON completion. Planned follow-ups:
> SSE streaming (`/api/v1/chat/stream`), agentic/tool turns, per-key rate limits,
> and an OpenAPI spec.
