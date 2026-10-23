import pytest
from routing.heuristic import build_route
from routing.solver import solve_route

def test_empty_input():
    assert build_route([]) == []

def test_single_stop():
    stop = {
        "stop_id": "S1",
        "order_id": "ORD-1",
        "stop_type": "pickup",
        "coordinates": (12.9352, 77.6245)
    }
    result = build_route([stop])
    assert result == [stop]

def test_multiple_stops():
    start = (12.9000, 77.6000)
    stop_far = {
        "stop_id": "S3",
        "order_id": "ORD-3",
        "stop_type": "pickup",
        "coordinates": (12.9300, 77.6000)
    }
    stop_near = {
        "stop_id": "S1",
        "order_id": "ORD-1",
        "stop_type": "pickup",
        "coordinates": (12.9100, 77.6000)
    }
    stop_mid = {
        "stop_id": "S2",
        "order_id": "ORD-2",
        "stop_type": "pickup",
        "coordinates": (12.9200, 77.6000)
    }
    result = build_route([stop_far, stop_near, stop_mid], start_location=start)
    assert len(result) == 3
    assert result[0]["stop_id"] == "S1"
    assert result[1]["stop_id"] == "S2"
    assert result[2]["stop_id"] == "S3"

def test_pickup_before_delivery_constraint():
    start = (12.9000, 77.6000)
    delivery_close = {
        "stop_id": "D1",
        "order_id": "ORD-1",
        "stop_type": "delivery",
        "coordinates": (12.9050, 77.6050)
    }
    pickup_far = {
        "stop_id": "P1",
        "order_id": "ORD-1",
        "stop_type": "pickup",
        "coordinates": (12.9500, 77.6500)
    }
    result = build_route([delivery_close, pickup_far], start_location=start)
    assert len(result) == 2
    assert result[0]["stop_id"] == "P1"
    assert result[1]["stop_id"] == "D1"

def test_multiple_orders_pickup_before_delivery():
    start = (12.9200, 77.6100)
    p1 = {"stop_id": "P1", "order_id": "ORD-1", "stop_type": "pickup", "coordinates": (12.9300, 77.6200)}
    d1 = {"stop_id": "D1", "order_id": "ORD-1", "stop_type": "delivery", "coordinates": (12.9400, 77.6300)}
    p2 = {"stop_id": "P2", "order_id": "ORD-2", "stop_type": "pickup", "coordinates": (12.9250, 77.6150)}
    d2 = {"stop_id": "D2", "order_id": "ORD-2", "stop_type": "delivery", "coordinates": (12.9450, 77.6350)}
    
    result = build_route([d1, d2, p1, p2], start_location=start)
    assert len(result) == 4
    
    stop_ids = [s["stop_id"] for s in result]
    assert stop_ids.index("P1") < stop_ids.index("D1")
    assert stop_ids.index("P2") < stop_ids.index("D2")

def test_solve_route_heuristic_selection():
    stop = {"stop_id": "S1", "order_id": "ORD-1", "stop_type": "pickup", "coordinates": (12.9352, 77.6245)}
    res = solve_route([stop], algorithm="heuristic")
    assert res["algorithm"] == "heuristic"
    assert res["fallback"] is False
    assert res["route"] == [stop]

def test_solve_route_auto_selection():
    stop = {"stop_id": "S1", "order_id": "ORD-1", "stop_type": "pickup", "coordinates": (12.9352, 77.6245)}
    res = solve_route([stop], algorithm="auto")
    assert res["algorithm"] == "heuristic"
    assert res["fallback"] is False
    assert res["route"] == [stop]

def test_solve_route_ortools_fallback_when_unavailable():
    stop = {"stop_id": "S1", "order_id": "ORD-1", "stop_type": "pickup", "coordinates": (12.9352, 77.6245)}
    res = solve_route([stop], algorithm="ortools")
    assert res["algorithm"] == "heuristic"
    assert res["fallback"] is True
    assert "OR-Tools" in res["reason"]
    assert res["route"] == [stop]

def test_solve_route_unsupported_algorithm_fallback():
    stop = {"stop_id": "S1", "order_id": "ORD-1", "stop_type": "pickup", "coordinates": (12.9352, 77.6245)}
    res = solve_route([stop], algorithm="custom_quantum_annealer")
    assert res["algorithm"] == "heuristic"
    assert res["fallback"] is True
    assert "not supported" in res["reason"]
    assert res["route"] == [stop]

def test_solve_route_empty_input():
    res = solve_route([], algorithm="auto")
    assert res["route"] == []
    assert res["algorithm"] == "heuristic"
    assert res["fallback"] is False
