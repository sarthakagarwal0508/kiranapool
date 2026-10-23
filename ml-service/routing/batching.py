from routing.distance import haversine_distance

def _get_order_details(order):
    if not isinstance(order, dict):
        raise TypeError("Order must be a dictionary")
    
    coords = order.get("coordinates")
    if coords is None:
        coords = order.get("location")
    if coords is None and "lat" in order and ("lon" in order or "lng" in order):
        lon = order.get("lon") if "lon" in order else order.get("lng")
        coords = (order["lat"], lon)
    if coords is None:
        raise ValueError("Order must contain coordinates or location")
    
    time_val = order.get("placement_time")
    if time_val is None:
        time_val = order.get("timestamp", 0.0)
    if not isinstance(time_val, (int, float)) or isinstance(time_val, bool):
        raise TypeError("Placement time must be numeric")
    
    weight_val = order.get("weight")
    if weight_val is None:
        weight_val = order.get("weight_kg", 0.0)
    if not isinstance(weight_val, (int, float)) or isinstance(weight_val, bool):
        raise TypeError("Weight must be numeric")
    
    return coords, float(time_val), float(weight_val)

def _is_compatible(order, batch, max_distance_km, max_time_window_minutes, max_orders_per_batch, max_weight_kg):
    if len(batch) >= max_orders_per_batch:
        return False
    
    cand_coords, cand_time, cand_weight = _get_order_details(order)
    
    total_weight = cand_weight
    times = [cand_time]
    
    for item in batch:
        item_coords, item_time, item_weight = _get_order_details(item)
        total_weight += item_weight
        times.append(item_time)
        if haversine_distance(cand_coords, item_coords) > max_distance_km:
            return False
            
    if total_weight > max_weight_kg:
        return False
        
    if (max(times) - min(times)) > max_time_window_minutes:
        return False
        
    return True

def batch_orders(orders, max_distance_km=1.2, max_time_window_minutes=8.0, max_orders_per_batch=4, max_weight_kg=18.0):
    if not orders:
        return []
    
    batches = []
    for order in orders:
        placed = False
        for batch in batches:
            if _is_compatible(order, batch, max_distance_km, max_time_window_minutes, max_orders_per_batch, max_weight_kg):
                batch.append(order)
                placed = True
                break
        if not placed:
            batches.append([order])
            
    return batches

group_orders = batch_orders
