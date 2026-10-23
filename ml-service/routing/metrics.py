from routing.distance import haversine_distance, _parse_coordinate

def _extract_coordinates(item):
    if isinstance(item, (tuple, list)):
        return item
    if isinstance(item, dict):
        if "coordinates" in item:
            return item["coordinates"]
        if "location" in item:
            return item["location"]
        if "lat" in item and ("lon" in item or "lng" in item):
            lon = item.get("lon") if "lon" in item else item.get("lng")
            return (item["lat"], lon)
    raise ValueError("Invalid coordinates format in stop")

def calculate_route_distance(route):
    if route is None:
        raise ValueError("Route cannot be None")
    if not isinstance(route, list):
        raise TypeError("Route must be a list of stops")
    
    parsed_coords = [_parse_coordinate(_extract_coordinates(stop)) for stop in route]
    if len(parsed_coords) < 2:
        return 0.0
    
    total_dist = 0.0
    for i in range(len(parsed_coords) - 1):
        total_dist += haversine_distance(parsed_coords[i], parsed_coords[i + 1])
    return total_dist

def calculate_travel_time(distance_km, speed_kmh=20.0):
    if not isinstance(distance_km, (int, float)) or isinstance(distance_km, bool):
        raise TypeError("Distance must be numeric")
    if distance_km < 0:
        raise ValueError("Distance cannot be negative")
    if speed_kmh <= 0:
        raise ValueError("Speed must be positive")
    
    return (float(distance_km) / float(speed_kmh)) * 60.0

def calculate_route_cost(distance_km, base_cost=30.0, per_km_rate=10.0):
    if not isinstance(distance_km, (int, float)) or isinstance(distance_km, bool):
        raise TypeError("Distance must be numeric")
    if distance_km < 0:
        raise ValueError("Distance cannot be negative")
    
    return float(base_cost) + float(per_km_rate) * float(distance_km)

def calculate_route_metrics(route, speed_kmh=20.0, base_cost=30.0, per_km_rate=10.0):
    if route is None:
        raise ValueError("Route cannot be None")
    if not isinstance(route, list):
        raise TypeError("Route must be a list of stops")
        
    if not route:
        return {
            "distance_km": 0.0,
            "travel_time_minutes": 0.0,
            "cost": 0.0
        }
        
    distance = calculate_route_distance(route)
    travel_time = calculate_travel_time(distance, speed_kmh=speed_kmh)
    cost = calculate_route_cost(distance, base_cost=base_cost, per_km_rate=per_km_rate)
    
    return {
        "distance_km": distance,
        "travel_time_minutes": travel_time,
        "cost": cost
    }
