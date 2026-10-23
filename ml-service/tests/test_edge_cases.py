# tests/test_edge_cases.py
import pytest
from routing.distance import haversine_distance
from routing.metrics import calculate_route_distance
from routing.heuristic import build_route
from routing.batching import batch_orders

# 1. Invalid coordinate formats -------------------------------------------------
@pytest.mark.parametrize(
    "bad_coord",
    [
        None,
        {"lat": "not-a-number", "lon": 77.0},
        (12.9, None),
        {"latitude": 12.9},                     # missing longitude
        {"lng": 77.0},                          # missing latitude
    ],
)
def test_invalid_coordinates_raise(bad_coord):
    route = [{"coordinates": bad_coord}]
    with pytest.raises((ValueError, TypeError)):
        # distance calculation validates coordinates internally
        calculate_route_distance(route)

# 2. Exact time‑window boundary -----------------------------------------------
def test_time_window_boundary_is_included():
    # contract: max time gap = 10.0 seconds (example – adjust if spec differs)
    order1 = {"order_id": "ORD-1", "coordinates": (12.9352, 77.6245),
              "placement_time": 0.0, "weight": 2.0}
    order2 = {"order_id": "ORD-2", "coordinates": (12.9370, 77.6260),
              "placement_time": 10.0, "weight": 2.0}
    batches = batch_orders([order1, order2])
    # Expect a single batch if the implementation uses <= max_gap
    assert len(batches) == 1
    assert len(batches[0]) == 2

# 3. Maximum order count per batch (example limit = 3) ------------------------
def test_max_orders_per_batch():
    # Assume contract defines MAX_ORDERS_PER_BATCH = 3
    orders = [
        {"order_id": f"ORD-{i}",
         "coordinates": (12.9352 + i * 0.001, 77.6245 + i * 0.001),
         "placement_time": i,
         "weight": 1.0}
        for i in range(4)          # four compatible orders
    ]
    batches = batch_orders(orders)
    # Expect two batches: 3 orders + 1 order
    assert len(batches) == 2
    assert len(batches[0]) == 3
    assert len(batches[1]) == 1

# 4. Service‑level error propagation (FastAPI) -------------------------------
def test_api_error_propagates():
    # The service entry point is `ml-service/main.py` which creates a FastAPI app.
    # Use the test client provided by FastAPI to send a malformed request.
    from fastapi.testclient import TestClient
    from main import app  # assumes `app` is the FastAPI instance

    client = TestClient(app)
    # Send a request missing the required "orders" field
    resp = client.post("/route", json={"invalid": "payload"})
    assert resp.status_code >= 500
    assert "error" in resp.json()
