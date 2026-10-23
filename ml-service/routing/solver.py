from routing.heuristic import build_route

try:
    from ortools.constraint_solver import routing_enums_pb2, pywrapcp
    ORTOOLS_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    ORTOOLS_AVAILABLE = False

def solve_route(stops, start_location=None, algorithm="auto"):
    if algorithm == "heuristic":
        route = build_route(stops, start_location)
        return {
            "route": route,
            "algorithm": "heuristic",
            "fallback": False
        }
    
    if algorithm in ("auto", "default"):
        if ORTOOLS_AVAILABLE:
            try:
                pass
            except Exception as e:
                route = build_route(stops, start_location)
                return {
                    "route": route,
                    "algorithm": "heuristic",
                    "fallback": True,
                    "reason": str(e)
                }
        route = build_route(stops, start_location)
        return {
            "route": route,
            "algorithm": "heuristic",
            "fallback": False
        }
        
    if algorithm in ("ortools", "cvrptw", "exact"):
        if not ORTOOLS_AVAILABLE:
            route = build_route(stops, start_location)
            return {
                "route": route,
                "algorithm": "heuristic",
                "fallback": True,
                "reason": "OR-Tools is not available in offline environment"
            }
        try:
            pass
        except Exception as e:
            route = build_route(stops, start_location)
            return {
                "route": route,
                "algorithm": "heuristic",
                "fallback": True,
                "reason": str(e)
            }
            
    route = build_route(stops, start_location)
    return {
        "route": route,
        "algorithm": "heuristic",
        "fallback": True,
        "reason": f"Algorithm '{algorithm}' is not supported"
    }

solve = solve_route
