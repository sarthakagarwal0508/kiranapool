import math
import pytest
from routing.distance import haversine_distance

def test_identical_coordinates():
    coord = (12.9716, 77.5946)
    assert haversine_distance(coord, coord) == 0.0

def test_two_different_valid_coordinates():
    coord1 = (12.9352, 77.6245)
    coord2 = (12.9719, 77.6412)
    distance = haversine_distance(coord1, coord2)
    assert isinstance(distance, float)
    assert 4.0 < distance < 5.0
    assert math.isclose(distance, 4.45, rel_tol=0.05)

def test_invalid_coordinates():
    with pytest.raises(ValueError):
        haversine_distance((95.0, 77.0), (12.0, 77.0))
    with pytest.raises(ValueError):
        haversine_distance((-95.0, 77.0), (12.0, 77.0))
    with pytest.raises(ValueError):
        haversine_distance((12.0, 190.0), (12.0, 77.0))
    with pytest.raises(ValueError):
        haversine_distance((12.0, -190.0), (12.0, 77.0))
    with pytest.raises(ValueError):
        haversine_distance((12.0,), (12.0, 77.0))
    with pytest.raises(TypeError):
        haversine_distance("invalid", (12.0, 77.0))
    with pytest.raises(TypeError):
        haversine_distance(("invalid", 77.0), (12.0, 77.0))
    with pytest.raises(ValueError):
        haversine_distance(None, (12.0, 77.0))
