"""KiranaPool ML Service Entry Point.

Intended Responsibility:
- Shared file (Coordinate before editing).
- Initializes and serves the HTTP API exposing route optimization, batching,
  and demand forecasting endpoints to the backend (Node.js/Express).
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from routing.batching import batch_orders
from routing.solver import solve_route

app = FastAPI(title="KiranaPool ML Service", version="0.1.0")


@app.post("/route")
async def optimize_route(request: Request):
    try:
        body = await request.json()
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Invalid JSON: {str(e)}"})

    if not isinstance(body, dict) or "orders" not in body:
        return JSONResponse(status_code=500, content={"error": "Malformed request: missing 'orders' field"})

    try:
        orders = body["orders"]
        batches = batch_orders(orders)
        routes = [solve_route(batch) for batch in batches]
        return {
            "status": "success",
            "batches_count": len(batches),
            "routes": routes
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/health")
def health_check():
    return {"status": "healthy"}
