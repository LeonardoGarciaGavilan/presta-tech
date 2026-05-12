# Auth / Refresh Token System

## Timing Parameters & Tradeoffs

| Parameter | Value | Where | Purpose |
|-----------|-------|-------|---------|
| `ACCESS_TOKEN_EXPIRY` | `1h` | `auth.service.ts:11` | How long access tokens are valid before requiring refresh |
| `bufferSeconds` | `60` | `api.js:46` | How early before expiry the frontend proactively refreshes |
| `TOKEN_REUSE_GRACE_MS` | `10_000` | `auth.service.ts:14` | Grace period for benign token reuse (F5 during refresh, multiple tabs) |
| `REFRESH_TOKEN_EXPIRY_DAYS` | `7` | `auth.service.ts:12` | How long the refresh cookie lives |

### Why these values?

- **1h access token**: Loan management apps have longer sessions; 15min caused excessive refresh calls (more race windows). 1h balances security with UX.
- **60s buffer**: The frontend tries to refresh when 1h remaining. Gives plenty of time even with network latency. Previously 30s — increased for more tolerance.
- **10s grace**: If a rotated token is reused within 10s, it's treated as a race condition (F5, tab sync), not theft. The backend logs a `WARN` audit entry but issues new tokens instead of killing all sessions.

### Race condition flow

1. User is on page with token T1 (about to expire or just expired)
2. Frontend calls `POST /auth/refresh` → backend rotates T1→T2, sends `Set-Cookie: refresh_token=T2`
3. User hits F5 before the cookie lands in the browser store
4. New page load sends `Cookie: refresh_token=T1` (old cookie)
5. Backend finds T1 revoked → checks `revokedAt` vs now → if < 10s → grants grace, issues T3
6. If > 10s → treats as theft, revokes ALL sessions, user must re-login

### What we trade off

- **Security**: A stolen token used within 10s could bypass the reuse detection. Acceptable for a small/medium SaaS. The alternative (killing all sessions on every race) made the app unusable.
- **UX**: Users almost never see "session compromised" errors now. Occasional silent token rotations happen behind the scenes.
