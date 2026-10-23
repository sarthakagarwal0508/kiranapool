from routing.distance import haversine_distance

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
    raise ValueError("Invalid coordinates format")

def build_route(stops, start_location=None):
    if not stops:
        return []
    
    if len(stops) == 1:
        return list(stops)
    
    unvisited = list(stops)
    route = []
    visited_pickups = set()
    
    pickup_orders = {
        s.get("order_id") for s in unvisited
        if isinstance(s, dict) and s.get("stop_type") == "pickup" and s.get("order_id") is not None
    }
    
    if start_location is not None:
        current_coords = _extract_coordinates(start_location)
    else:
        current_coords = None
        
    while unvisited:
        eligible_stops = []
        for s in unvisited:
            if not isinstance(s, dict):
                eligible_stops.append(s)
                continue
            
            st_type = s.get("stop_type")
            order_id = s.get("order_id")
            
            if st_type == "delivery" and order_id in pickup_orders:
                if order_id in visited_pickups:
                    eligible_stops.append(s)
            else:
                eligible_stops.append(s)
        
        if not eligible_stops:
            break
            
        if current_coords is None:
            best_stop = eligible_stops[0]
        else:
            best_stop = None
            best_dist = float("inf")
            for s in eligible_stops:
                coords = _extract_coordinates(s)
                dist = haversine_distance(current_coords, coords)
                if dist < best_dist:
                    best_dist = dist
                    best_stop = s
                    
        route.append(best_stop)
        unvisited.remove(best_stop)
        
        if isinstance(best_stop, dict) and best_stop.get("stop_type") == "pickup":
            order_id = best_stop.get("order_id")
            if order_id is not None:
                visited_pickups.add(order_id)
                
        current_coords = _extract_coordinates(best_stop)
        
    if unvisited:
        route.extend(unvisited)
        
    return route

nearest_neighbor_route = build_route
