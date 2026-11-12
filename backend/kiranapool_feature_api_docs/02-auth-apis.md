# Authentication APIs

**Feature:** Local authentication, Google sign-in verification, server-managed JWT sessions  
**Base URL:** `http://localhost:5000/api`

## Browser session behavior

Login, signup and Google sign-in set an `HttpOnly` `kp_access` cookie and a separate readable `kp_csrf` cookie. The JWT is **not returned in the JSON response** and should not be stored in `localStorage` or `sessionStorage`.

For browser requests, the frontend must:

- Send requests with `credentials: "include"`.
- Keep the `csrfToken` returned by login/signup/Google sign-in in memory. After a full page refresh, call `GET /auth/csrf` and keep its `csrfToken` response value in memory. This endpoint also sets the matching API-domain `kp_csrf` cookie.
- For `POST`, `PATCH`, `PUT` and `DELETE`, send the in-memory value in the `X-CSRF-Token` header. This works across the current Vercel/Render domains; frontend JavaScript cannot read an API-domain cookie through `document.cookie`.
- Call `POST /auth/logout` to revoke sessions and clear cookies.

The API also accepts `Authorization: Bearer <JWT>` for native clients and backwards-compatible integrations. Bearer clients do not need the CSRF header. New browser clients should use cookies.

## `POST /auth/signup`

Creates a local account.

```json
{
  "name": "Aman Sharma",
  "email": "aman@example.com",
  "password": "example-password",
  "role": "shopkeeper"
}
```

- `shopkeeper` can self-register.
- `wholesaler` requires `WHOLESALER_SIGNUP_INVITE_CODE` and an `inviteCode` request property.
- `rider` requires `RIDER_SIGNUP_INVITE_CODE` and an `inviteCode` request property.
- Password length: 8–128 characters.
- Success: `201 Created`; session cookies are set; response returns `{ success, message, csrfToken, user }` but no JWT.

## `POST /auth/login`

```json
{ "email": "aman@example.com", "password": "example-password" }
```

Success: `200 OK`; session cookies are set; response returns `{ success, message, csrfToken, user }` and no JWT.

## `POST /auth/google`

Verifies a Google ID token. Request:

```json
{ "idToken": "<GOOGLE_ID_TOKEN>", "role": "shopkeeper" }
```

A new wholesaler/rider Google account also requires the matching `inviteCode`. Existing accounts keep their stored role.

## `GET /auth/csrf`

Sets/refreshes the readable `kp_csrf` cookie and returns `{ success, csrfToken }`. The CSRF value may be read by the frontend and sent in `X-CSRF-Token`; it is not an authentication credential. This endpoint is useful after a full page reload when the frontend's in-memory CSRF value is lost.

## `GET /auth/me`

Returns the authenticated user's basic details. Works with the browser cookie or a Bearer token.

## `POST /auth/logout`

Requires authentication. Increments the account's token version (revoking all active sessions/tokens for that account) and clears browser cookies. Cookie-authenticated requests must include `X-CSRF-Token`.

## Cookie / environment settings

- `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=None` are recommended for cross-origin HTTPS deployment.
- Set `FRONTEND_URL` to the exact allowed frontend origin(s), comma-separated.
- For local development use `COOKIE_SECURE=false`, `COOKIE_SAME_SITE=Lax`.
- `JWT_SECRET` must be at least 32 characters; use a fresh random secret.
