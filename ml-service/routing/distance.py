import math

def _parse_coordinate(coord):
    if coord is None:
        raise ValueError("Coordinate cannot be None")
    
    if isinstance(coord, (tuple, list)):
        if len(coord) != 2:
            raise ValueError("Coordinate tuple or list must have exactly two elements")
        lat, lon = coord[0], coord[1]
    elif isinstance(coord, dict):
        if "lat" in coord:
            lat = coord["lat"]
        elif "latitude" in coord:
            lat = coord["latitude"]
        else:
            raise ValueError("Coordinate dictionary missing latitude key")
        
        if "lon" in coord:
            lon = coord["lon"]
        elif "lng" in coord:
            lon = coord["lng"]
        elif "longitude" in coord:
            lon = coord["longitude"]
        else:
            raise ValueError("Coordinate dictionary missing longitude key")
    else:
        raise TypeError("Coordinate must be a tuple, list, or dictionary")
    
    if isinstance(lat, bool) or isinstance(lon, bool):
        raise TypeError("Coordinates cannot be boolean values")
    
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        raise TypeError("Coordinates must be numeric")
    
    if math.isnan(lat) or math.isnan(lon) or math.isinf(lat) or math.isinf(lon):
        raise ValueError("Coordinates must be finite numbers")
    
    if not (-90.0 <= lat <= 90.0):
        raise ValueError("Latitude must be between -90 and 90 degrees")
    if not (-180.0 <= lon <= 180.0):
        raise ValueError("Longitude must be between -180 and 180 degrees")
    
    return float(lat), float(lon)

def haversine_distance(coord1, coord2=None, lat2=None, lon2=None):
    if coord2 is not None and lat2 is not None and lon2 is not None:
        lat1, lon1 = _parse_coordinate((coord1, coord2))
        lat2, lon2 = _parse_coordinate((lat2, lon2))
    elif coord2 is not None and lat2 is None and lon2 is None:
        lat1, lon1 = _parse_coordinate(coord1)
        lat2, lon2 = _parse_coordinate(coord2)
    else:
        raise ValueError("Two coordinates are required")
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    
    radius_km = 6371.0
    return radius_km * c

calculate_distance = haversine_distance
