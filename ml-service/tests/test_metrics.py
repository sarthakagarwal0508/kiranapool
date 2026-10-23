import pytest
import math
from routing.metrics import (
    calculate_route_distance,
    calculate_travel_time,
    calculate_route_cost,
    calculate_route_metrics
)
from routing.reasons import (
    explain_route,
    explain_route_comparison,
    explain_solver_status,
    explain_batching_decision
)

def test_calculate_route_distance():
    assert calculate_route_distance([]) == 0.0
    assert calculate_route_distance([{"coordinates": (12.9352, 77.6245)}]) == 0.0
    
    stop1 = {"coordinates": (12.9352, 77.6245)}
    stop2 = {"coordinates": (12.9719, 77.6412)}
    dist = calculate_route_distance([stop1, stop2])
    assert math.isclose(dist, 4.45, rel_tol=0.05)

def test_calculate_route_distance_invalid_input():
    with pytest.raises(ValueError):
        calculate_route_distance(None)
    with pytest.raises(TypeError):
        calculate_route_distance("invalid_route")

def test_calculate_travel_time():
    assert calculate_travel_time(0.0) == 0.0
    assert calculate_travel_time(10.0, speed_kmh=20.0) == 30.0
    assert calculate_travel_time(20.0, speed_kmh=20.0) == 60.0
    
    with pytest.raises(ValueError):
        calculate_travel_time(-5.0)
    with pytest.raises(ValueError):
        calculate_travel_time(5.0, speed_kmh=0)

def test_calculate_route_cost():
    assert calculate_route_cost(0.0) == 30.0
    assert calculate_route_cost(5.0, base_cost=30.0, per_km_rate=10.0) == 80.0
    
    with pytest.raises(ValueError):
        calculate_route_cost(-1.0)
    with pytest.raises(TypeError):
        calculate_route_cost("invalid")

def test_calculate_route_metrics_empty_and_valid():
    empty_res = calculate_route_metrics([])
    assert empty_res["distance_km"] == 0.0
    assert empty_res["travel_time_minutes"] == 0.0
    assert empty_res["cost"] == 0.0
    
    stop1 = {"coordinates": (12.9352, 77.6245)}
    stop2 = {"coordinates": (12.9719, 77.6412)}
    res = calculate_route_metrics([stop1, stop2])
    assert res["distance_km"] > 4.0
    assert res["travel_time_minutes"] > 12.0
    assert res["cost"] > 70.0

def test_explain_route():
    assert explain_route([]) == "Route has no stops."
    
    route = [{"coordinates": (12.9352, 77.6245)}, {"coordinates": (12.9719, 77.6412)}]
    metrics = calculate_route_metrics(route)
    explanation = explain_route(route, metrics)
    assert "2 stops" in explanation
    assert f"{metrics['distance_km']:.2f} km" in explanation
    assert f"₹{metrics['cost']:.2f}" in explanation

def test_explain_route_comparison_factual():
    pooled = {"distance_km": 5.0, "cost": 80.0}
    solo = {"distance_km": 10.0, "cost": 130.0}
    text_cheaper = explain_route_comparison(pooled, solo)
    assert "saves ₹50.00" in text_cheaper
    assert "reduces distance by 5.00 km" in text_cheaper
    
    costlier = {"distance_km": 12.0, "cost": 150.0}
    text_costlier = explain_route_comparison(costlier, solo)
    assert "costs ₹20.00 more" in text_costlier
    assert "increases distance by 2.00 km" in text_costlier

def test_explain_solver_status():
    success = {"algorithm": "heuristic", "fallback": False}
    assert "solved successfully" in explain_solver_status(success)
    
    fallback = {"algorithm": "heuristic", "fallback": True, "reason": "OR-Tools offline"}
    status = explain_solver_status(fallback)
    assert "Used fallback" in status
    assert "OR-Tools offline" in status

def test_explain_batching_decision():
    assert "pooled successfully" in explain_batching_decision(True)
    assert "distance threshold" in explain_batching_decision(False, reason_code="DISTANCE_EXCEEDED")
    assert "time window" in explain_batching_decision(False, reason_code="TIME_WINDOW_EXCEEDED")
    assert "batch capacity" in explain_batching_decision(False, reason_code="CAPACITY_EXCEEDED")
