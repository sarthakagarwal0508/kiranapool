DEFAULT_SPEED_KMH = 20.0


def estimate_travel_time(distance_km, speed_kmh=DEFAULT_SPEED_KMH, unit="minutes"):
    """
    Calculate estimated travel time from distance and speed.

    Units:
        distance_km: kilometers (km, must be >= 0)
        speed_kmh: kilometers per hour (km/h, must be > 0)
        unit: 'minutes' (default), 'hours', or 'seconds'

    Returns:
        float: estimated duration in the requested unit
    """
    if not isinstance(distance_km, (int, float)) or not isinstance(speed_kmh, (int, float)):
        raise TypeError("Distance and speed must be numbers")

    if distance_km < 0:
        raise ValueError("Distance cannot be negative")

    if speed_kmh <= 0:
        raise ValueError("Speed must be greater than zero")

    if unit not in ("minutes", "hours", "seconds"):
        raise ValueError("Unit must be one of: 'minutes', 'hours', 'seconds'")

    if distance_km == 0 or distance_km == 0.0:
        return 0.0

    hours = distance_km / speed_kmh

    if unit == "hours":
        return round(hours, 4)
    if unit == "seconds":
        return round(hours * 3600.0, 2)
    return round(hours * 60.0, 2)


def estimate_route_travel_time(
    leg_distances_km,
    speed_kmh=DEFAULT_SPEED_KMH,
    stop_delay_minutes=0.0,
    unit="minutes",
):
    """
    Calculate total estimated travel time for a sequence of route legs.

    Units:
        leg_distances_km: list of leg distances in kilometers (km)
        speed_kmh: kilometers per hour (km/h, must be > 0)
        stop_delay_minutes: additional service or handling delay per intermediate stop in minutes
        unit: 'minutes' (default), 'hours', or 'seconds'

    Returns:
        float: total estimated duration in the requested unit
    """
    if not isinstance(leg_distances_km, list):
        raise TypeError("leg_distances_km must be a list of numbers")

    if not isinstance(stop_delay_minutes, (int, float)) or stop_delay_minutes < 0:
        raise ValueError("stop_delay_minutes must be a non-negative number")

    total_travel_minutes = 0.0
    for leg_dist in leg_distances_km:
        total_travel_minutes += estimate_travel_time(leg_dist, speed_kmh=speed_kmh, unit="minutes")

    intermediate_stops = max(0, len(leg_distances_km) - 1)
    total_minutes = total_travel_minutes + (intermediate_stops * stop_delay_minutes)

    if unit == "minutes":
        return round(total_minutes, 2)
    if unit == "hours":
        return round(total_minutes / 60.0, 4)
    if unit == "seconds":
        return round(total_minutes * 60.0, 2)
    raise ValueError("Unit must be one of: 'minutes', 'hours', 'seconds'")
