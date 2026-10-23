import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_legacy_route_endpoint():
    orders = [
        {"id": "o1", "lat": 12.9352, "lng": 77.6245, "weight": 2.0, "placement_time": 10},
        {"id": "o2", "lat": 12.9360, "lng": 77.6250, "weight": 1.5, "placement_time": 15},
    ]
    response = client.post("/route", json={"orders": orders})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["batches_count"] >= 1
    assert len(data["routes"]) == data["batches_count"]


def test_routes_solve_endpoint():
    stops = [
        {"stop_id": "S1", "coordinates": (12.9350, 77.6240)},
        {"stop_id": "S2", "coordinates": (12.9360, 77.6250)},
    ]
    response = client.post("/routes/solve", json={"stops": stops, "start_location": [12.9300, 77.6200]})
    assert response.status_code == 200
    data = response.json()
    assert len(data["route"]) == 2
    assert "distance_km" in data
    assert "travel_time_minutes" in data


def test_batch_endpoint():
    orders = [
        {"id": "o1", "lat": 12.9352, "lng": 77.6245, "weight": 2.0, "placement_time": 10},
        {"id": "o2", "lat": 12.9355, "lng": 77.6248, "weight": 3.0, "placement_time": 12},
    ]
    response = client.post("/batch", json={"orders": orders, "max_orders_per_batch": 2})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["batches_count"] >= 1


def test_forecast_endpoint():
    history = [
        {"shop_id": "shop_1", "time_interval": "09:00-11:00", "demand": 10},
        {"shop_id": "shop_1", "time_interval": "09:00-11:00", "demand": 14},
    ]
    response = client.post(
        "/forecast",
        json={"shop_id": "shop_1", "time_interval": "09:00-11:00", "historical_data": history},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["forecasted_demand"] == 12.0
    assert data["shop_id"] == "shop_1"


def test_backend_forecast_contract():
    payload = {
        "horizonDays": 2,
        "groupBy": "both",
        "shops": [{"shopId": "s1", "name": "Shop 1", "area": "Mansarovar"}],
        "history": [
            {"shopId": "s1", "area": "Mansarovar", "deliverySlotStart": "2026-10-23T09:00:00Z"}
        ],
    }
    response = client.post("/forecast", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "forecasts" in data
    assert isinstance(data["forecasts"], list)
    assert len(data["forecasts"]) > 0
    first = data["forecasts"][0]
    assert "forecastDate" in first
    assert "scope" in first
    assert "predictedOrders" in first
    assert first["predictedOrders"] >= 0


def test_forecast_all_endpoint():
    history = [
        {"shop_id": "shop_1", "time_interval": "09:00-11:00", "demand": 10},
        {"shop_id": "shop_2", "time_interval": "09:00-11:00", "demand": 8},
    ]
    response = client.post("/forecast/all", json={"historical_data": history, "time_interval": "09:00-11:00"})
    assert response.status_code == 200
    data = response.json()
    assert "forecasts" in data
    assert data["forecasts"]["shop_1"] == 10.0
    assert data["forecasts"]["shop_2"] == 8.0



def test_travel_time_endpoint():
    response = client.post("/travel-time", json={"distance_km": 10.0, "speed_kmh": 20.0, "unit": "minutes"})
    assert response.status_code == 200
    data = response.json()
    assert data["estimated_travel_time"] == 30.0

    err_resp = client.post("/travel-time", json={"distance_km": -5.0})
    assert err_resp.status_code == 422 or err_resp.status_code == 400


def test_economics_costs_endpoint():
    payload = {
        "solo_distances": [4.0, 6.0],
        "total_pooled_distance": 7.0,
        "num_orders": 2,
        "base_cost": 20.0,
        "cost_per_km": 10.0,
        "cost_per_drop": 5.0,
    }
    response = client.post("/economics/costs", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["solo_cost"] == 140.0
    assert data["pooled_cost"] == 95.0
    assert data["savings_amount"] == 45.0
    assert data["savings_percentage"] > 0


def test_delivery_plan_endpoint():
    orders = [
        {"id": "o1", "shop_id": "s1", "lat": 12.9352, "lng": 77.6245, "weight": 2.0, "placement_time": 5},
        {"id": "o2", "shop_id": "s1", "lat": 12.9360, "lng": 77.6250, "weight": 1.5, "placement_time": 8},
        {"id": "o3", "shop_id": "s2", "lat": 12.9370, "lng": 77.6260, "weight": 3.0, "placement_time": 12},
    ]
    payload = {
        "orders": orders,
        "start_location": [12.9340, 77.6230],
        "speed_kmh": 20.0,
        "base_cost": 20.0,
        "cost_per_km": 10.0,
    }
    response = client.post("/routes/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["total_orders"] == 3
    assert data["total_batches"] >= 1
    assert data["total_distance_km"] > 0
    assert data["total_travel_time_minutes"] > 0
    assert data["total_solo_cost"] > 0
    assert data["total_pooled_cost"] > 0
    assert len(data["batches"]) == data["total_batches"]
