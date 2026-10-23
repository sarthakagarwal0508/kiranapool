import pytest
from routing.batching import batch_orders

def test_empty_input():
    assert batch_orders([]) == []

def test_single_order():
    order = {
        "order_id": "ORD-1",
        "coordinates": (12.9352, 77.6245),
        "placement_time": 0.0,
        "weight": 2.5
    }
    result = batch_orders([order])
    assert len(result) == 1
    assert len(result[0]) == 1
    assert result[0][0]["order_id"] == "ORD-1"

def test_nearby_compatible_orders():
    order1 = {
        "order_id": "ORD-1",
        "coordinates": (12.9352, 77.6245),
        "placement_time": 2.0,
        "weight": 3.0
    }
    order2 = {
        "order_id": "ORD-2",
        "coordinates": (12.9370, 77.6260),
        "placement_time": 5.0,
        "weight": 4.0
    }
    result = batch_orders([order1, order2])
    assert len(result) == 1
    assert len(result[0]) == 2
    assert {result[0][0]["order_id"], result[0][1]["order_id"]} == {"ORD-1", "ORD-2"}

def test_orders_separated_by_distance():
    order1 = {
        "order_id": "ORD-1",
        "coordinates": (12.9352, 77.6245),
        "placement_time": 1.0,
        "weight": 2.0
    }
    order2 = {
        "order_id": "ORD-2",
        "coordinates": (12.9719, 77.6412),
        "placement_time": 2.0,
        "weight": 2.0
    }
    result = batch_orders([order1, order2])
    assert len(result) == 2
    assert len(result[0]) == 1
    assert len(result[1]) == 1

def test_orders_separated_by_time_window():
    order1 = {
        "order_id": "ORD-1",
        "coordinates": (12.9352, 77.6245),
        "placement_time": 0.0,
        "weight": 2.0
    }
    order2 = {
        "order_id": "ORD-2",
        "coordinates": (12.9370, 77.6260),
        "placement_time": 12.0,
        "weight": 2.0
    }
    result = batch_orders([order1, order2])
    assert len(result) == 2
    assert len(result[0]) == 1
    assert len(result[1]) == 1

def test_orders_separated_by_capacity():
    order1 = {
        "order_id": "ORD-1",
        "coordinates": (12.9352, 77.6245),
        "placement_time": 1.0,
        "weight": 11.0
    }
    order2 = {
        "order_id": "ORD-2",
        "coordinates": (12.9370, 77.6260),
        "placement_time": 2.0,
        "weight": 9.0
    }
    result = batch_orders([order1, order2])
    assert len(result) == 2
    assert len(result[0]) == 1
    assert len(result[1]) == 1
