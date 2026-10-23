# Health API

**Feature:** Backend and database health  
**Base URL:** `http://localhost:5000/api`

## `GET /health`
Checks API and MongoDB connection state.

- Authentication: Not required
- Success: `200 OK`
- Database disconnected: `503 Service Unavailable`

### Example success response
```json
{
  "success": true,
  "message": "KiranaPool API is healthy",
  "services": {
    "api": "running",
    "database": "connected"
  }
}
```
