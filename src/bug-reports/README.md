# Bug Reporting System — Backend

In-app "Report a Problem" backend: report intake, screenshot/replay storage,
automatic PII scrubbing, AI triage, duplicate grouping, and a support-team
admin dashboard API.

All routes are under the global prefix `/api/v1` and require a JWT
(`Authorization: Bearer <token>`) — the global `JwtAuthGuard` is active.
Admin routes additionally require `role = ADMIN` (`AdminGuard`).

## Data model

| Table                  | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `BugReport`            | One report. `ticketNumber` is the public ticket id.  |
| `BugReportComment`     | Threaded notes — `internal` (staff) or reporter-visible. |
| `BugReportAttachment`  | Screenshots, annotation layers, replay bundles, logs. |

Enums: `BugCategory`, `BugSeverity` (LOW/MEDIUM/HIGH/CRITICAL),
`BugStatus` (OPEN/INVESTIGATING/FIXED/CLOSED), `BugAttachmentKind`.

JSON columns (`deviceInfo`, `appInfo`, `metadata`, `logs`) and the
`title`/`description` text are **PII-scrubbed before insert** — see
[`pii.util.ts`](./pii.util.ts). Passwords, tokens, card data, etc. are dropped;
emails and phone numbers are masked.

## File uploads

Screenshots and replay bundles are uploaded directly to object storage by the
client, then their public URLs are passed in the create payload. Get a presigned
PUT URL first:

```
POST /api/v1/uploads/presign
{ "contentType": "image/png", "folder": "bug-reports" }
→ { uploadUrl, publicUrl, key, expiresIn, maxBytes }
```

PUT the bytes to `uploadUrl`, then send `publicUrl` as `screenshotUrl` /
`replayUrl` / attachment `url`.

## Reporter endpoints

### `POST /api/v1/bug-reports`
Create a report. Throttled to 10/min/user. Triage runs asynchronously, so the
response returns immediately with a ticket number.

```jsonc
// request
{
  "title": "App crashes when opening chat",
  "description": "Tapping a conversation closes the app instantly.",
  "category": "CHAT",                       // BugCategory enum
  "route": "/chat/abc123",
  "screenshotUrl": "https://cdn/.../bug-reports/uid/uuid",
  "replayUrl": "https://cdn/.../bug-reports/uid/replay.json",
  "deviceInfo": { "model": "iPhone 15", "os": "iOS 18.2", "screen": "1179x2556",
                  "language": "en", "timezone": "Asia/Tehran" },
  "appInfo": { "appVersion": "2.13.0", "build": "451", "apiEnv": "production" },
  "metadata": { "navStack": ["/home","/chat","/chat/abc123"],
                "network": "wifi", "memoryMb": 412, "fps": 58 },
  "logs": [ { "level": "error", "msg": "TypeError ...", "ts": 1700000000 } ],
  "attachments": [ { "kind": "ANNOTATION", "url": "https://cdn/.../a.png" } ],
  "clientToken": "offline-queue-uuid"       // optional idempotency key
}

// response 201
{ "id": "uuid", "ticketNumber": "100042", "status": "OPEN", "createdAt": "..." }
```

`clientToken` makes the offline queue safe: retrying the same submit within 1h
returns the original ticket instead of creating a duplicate.

### `GET /api/v1/bug-reports/mine?cursor=<id>`
The caller's own reports (cursor-paginated, 30/page).
`→ { data: BugReport[], nextCursor: string | null }`

### `GET /api/v1/bug-reports/mine/:id`
One of the caller's own reports (reporter-safe field subset).

## Admin / support endpoints  (`role = ADMIN`)

### `GET /api/v1/admin/bug-reports`
List + search + filter (cursor-paginated). Query params:

| Param        | Meaning                                                |
| ------------ | ------------------------------------------------------ |
| `status`     | `OPEN` / `INVESTIGATING` / `FIXED` / `CLOSED`          |
| `category`   | `BugCategory`                                          |
| `severity`   | `BugSeverity`                                          |
| `appVersion` | matches `appInfo.appVersion`                           |
| `device`     | matches `deviceInfo.model`                             |
| `assignee`   | agent user id, or `unassigned`                         |
| `q`          | free-text over ticket number, title, description       |
| `cursor`     | pagination cursor                                      |

### `GET /api/v1/admin/bug-reports/:id`
Full report incl. reporter, assignee, attachments, comments, AI triage,
and duplicate-of reference.

### `GET /api/v1/admin/bug-reports/:id/duplicates`
Other reports sharing this report's fingerprint.

### `PATCH /api/v1/admin/bug-reports/:id`
Update workflow fields (all optional):
```jsonc
{ "status": "INVESTIGATING", "severity": "HIGH",
  "assigneeId": "user-uuid",        // null to unassign
  "fixVersion": "2.14.0",           // null to clear
  "duplicateOfId": "report-uuid" }  // null to clear
```
Setting `status` to `FIXED`/`CLOSED` stamps `resolvedAt`.

### `POST /api/v1/admin/bug-reports/:id/comments`
```jsonc
{ "body": "Reproduced on staging.", "internal": true }
```

## AI triage

On create, [`bug-triage.service.ts`](./bug-triage.service.ts) computes a
duplicate `fingerprint` synchronously, then asynchronously produces
`aiSummary`, `aiProbableCause`, `aiSeverity`, and `aiReproSteps`.

- With `ANTHROPIC_API_KEY` set, it calls Claude (`BUG_TRIAGE_MODEL`, default
  `claude-haiku-4-5`) via the Messages API and parses a strict JSON response.
- Without the key (or on any API error/timeout), it falls back to a
  deterministic keyword heuristic. No npm dependency is added — it uses `fetch`.

The AI severity is adopted as the working `severity` while the report is fresh;
support can override it via `PATCH`.

## Environment

```
ANTHROPIC_API_KEY=""            # optional; empty → heuristic triage
BUG_TRIAGE_MODEL="claude-haiku-4-5"
```

## Migration

`prisma/migrations/20260613154606_bug_reports`. Apply with
`pnpm prisma:migrate` (dev) or `prisma migrate deploy` (prod).
