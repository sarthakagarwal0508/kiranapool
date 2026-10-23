def explain_route(route, metrics=None):
    if not route:
        return "Route has no stops."
    
    num_stops = len(route)
    if metrics is None:
        return f"Route consists of {num_stops} stop{'s' if num_stops != 1 else ''}."
    
    dist = metrics.get("distance_km", 0.0)
    time = metrics.get("travel_time_minutes", 0.0)
    cost = metrics.get("cost", 0.0)
    return (f"Route consists of {num_stops} stop{'s' if num_stops != 1 else ''} "
            f"covering {dist:.2f} km with estimated travel time of {time:.1f} minutes "
            f"at a cost of ₹{cost:.2f}.")

def explain_route_comparison(pooled_metrics, solo_metrics):
    if not pooled_metrics or not solo_metrics:
        raise ValueError("Both pooled and solo metrics are required for comparison")
    
    pooled_cost = pooled_metrics.get("cost", 0.0)
    solo_cost = solo_metrics.get("cost", 0.0)
    pooled_dist = pooled_metrics.get("distance_km", 0.0)
    solo_dist = solo_metrics.get("distance_km", 0.0)
    
    cost_diff = solo_cost - pooled_cost
    dist_diff = solo_dist - pooled_dist
    
    parts = []
    if cost_diff > 0:
        pct = (cost_diff / solo_cost) * 100.0 if solo_cost > 0 else 0.0
        parts.append(f"saves ₹{cost_diff:.2f} ({pct:.1f}% cost reduction)")
    elif cost_diff < 0:
        parts.append(f"costs ₹{abs(cost_diff):.2f} more than solo routing")
    else:
        parts.append("has identical cost to solo routing")
        
    if dist_diff > 0:
        parts.append(f"reduces distance by {dist_diff:.2f} km")
    elif dist_diff < 0:
        parts.append(f"increases distance by {abs(dist_diff):.2f} km")
    else:
        parts.append("has identical distance to solo routing")
        
    return f"Pooled route {' and '.join(parts)}."

def explain_solver_status(solver_result):
    if not isinstance(solver_result, dict):
        raise TypeError("Solver result must be a dictionary")
    
    algo = solver_result.get("algorithm", "heuristic")
    is_fallback = solver_result.get("fallback", False)
    reason = solver_result.get("reason")
    
    if is_fallback:
        msg = f"Used fallback algorithm '{algo}'"
        if reason:
            msg += f" due to: {reason}."
        else:
            msg += "."
        return msg
    
    return f"Route solved successfully using '{algo}' algorithm."

def explain_batching_decision(is_pooled, reason_code=None, details=None):
    if is_pooled:
        return "Order pooled successfully into active batch."
    
    if reason_code == "DISTANCE_EXCEEDED":
        return "Order was not pooled: exceeds maximum distance threshold."
    if reason_code == "TIME_WINDOW_EXCEEDED":
        return "Order was not pooled: exceeds maximum pooling time window."
    if reason_code == "CAPACITY_EXCEEDED":
        return "Order was not pooled: exceeds batch capacity limit."
    
    if reason_code:
        return f"Order was not pooled due to: {reason_code}."
    
    return "Order was not pooled."
