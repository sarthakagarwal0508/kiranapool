# Authentication APIs

**Feature:** Local authentication, Google sign-in verification, JWT identity  
**Base URL:** `http://localhost:5000/api`

## `POST /auth/signup`
Creates a local account.

### Request
```json
{
  "name": "Aman Sharma",
  "email": "aman@example.com",
  "password": "example-password",
  "role": "shopkeeper"
}
```
- `role`: `shopkeeper`, `wholesaler` or `rider`
- Password minimum length: 8 characters
- Success: `201 Created`; returns token and user
- Common errors: `400` validation, `409` duplicate email

## `POST /auth/login`
Logs in with email and password.

### Request
```json
{
  "email": "aman@example.com",
  "password": "example-password"
}
```
- Success: `200 OK`; returns JWT and user
- Invalid credentials: `401 Unauthorized`

## `POST /auth/google`
Verifies a Google Sign-In ID token and returns a KiranaPool JWT.

- Requires `GOOGLE_CLIENT_ID` in environment
- Request token property must match the current controller implementation.
- For a new account, role must be `shopkeeper`, `wholesaler` or `rider`; an existing account keeps its existing role.
- Real Google ID-token flow: live verification pending.

Example request (the controller expects `idToken`):
```json
{
  "idToken": "<GOOGLE_ID_TOKEN>",
  "role": "shopkeeper"
}
```

## `GET /auth/me`
Returns the authenticated user's basic details (`id`, `name`, `email`, `role`).

- Authentication: Required
- Success: `200 OK`
- Missing/invalid JWT: `401 Unauthorized`

## Authentication header
For protected routes:
`Authorization: Bearer <JWT_TOKEN>`
