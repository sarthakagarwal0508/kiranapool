def calculate_delivery_cost(
    distance,
    base_cost=0.0,
    cost_per_km=0.0,
    extra_stops=0,
    cost_per_stop=0.0,
):
    if distance < 0 or base_cost < 0 or cost_per_km < 0 or extra_stops < 0 or cost_per_stop < 0:
        raise ValueError("Distances, stops, and cost parameters cannot be negative")
    return round(base_cost + (distance * cost_per_km) + (extra_stops * cost_per_stop), 2)


def calculate_solo_cost(distances, base_cost=0.0, cost_per_km=0.0, cost_params=None):
    if cost_params is not None:
        base_cost = cost_params.get("base_cost", base_cost)
        cost_per_km = cost_params.get("cost_per_km", cost_params.get("cost_per_unit_distance", cost_per_km))

    if base_cost < 0 or cost_per_km < 0:
        raise ValueError("Cost parameters cannot be negative")

    if isinstance(distances, (int, float)):
        if distances < 0:
            raise ValueError("Distance cannot be negative")
        return round(base_cost + (distances * cost_per_km), 2)

    if isinstance(distances, list):
        total = 0.0
        for d in distances:
            if not isinstance(d, (int, float)) or d < 0:
                raise ValueError("All distances in list must be non-negative numbers")
            total += base_cost + (d * cost_per_km)
        return round(total, 2)

    raise TypeError("Distances must be a number or a list of numbers")


def calculate_pooled_cost(
    distance,
    num_orders=1,
    base_cost=0.0,
    cost_per_km=0.0,
    cost_per_drop=0.0,
    cost_params=None,
):
    if cost_params is not None:
        base_cost = cost_params.get("base_cost", base_cost)
        cost_per_km = cost_params.get("cost_per_km", cost_per_km)
        cost_per_drop = cost_params.get("cost_per_drop", cost_per_drop)

    if (
        distance < 0
        or num_orders < 0
        or base_cost < 0
        or cost_per_km < 0
        or cost_per_drop < 0
    ):
        raise ValueError("Distances, order counts, and cost parameters cannot be negative")

    extra_drops = max(0, num_orders - 1)
    return round(base_cost + (distance * cost_per_km) + (extra_drops * cost_per_drop), 2)


def calculate_savings_amount(solo_cost, pooled_cost):
    if solo_cost < 0 or pooled_cost < 0:
        raise ValueError("Costs cannot be negative")
    return round(solo_cost - pooled_cost, 2)


def calculate_savings_percentage(solo_cost, pooled_cost=None, savings_amount=None):
    if solo_cost < 0:
        raise ValueError("Solo cost cannot be negative")
    if solo_cost == 0:
        return None

    if savings_amount is None:
        if pooled_cost is None:
            raise ValueError("Either pooled_cost or savings_amount must be provided")
        if pooled_cost < 0:
            raise ValueError("Pooled cost cannot be negative")
        savings_amount = solo_cost - pooled_cost

    return round((savings_amount / solo_cost) * 100.0, 2)


def calculate_per_shop_savings(shop_solo_costs, total_pooled_cost, allocation_method=None):
    if allocation_method is None:
        return None

    if total_pooled_cost < 0:
        raise ValueError("Total pooled cost cannot be negative")

    if not isinstance(shop_solo_costs, dict):
        raise TypeError("shop_solo_costs must be a dictionary of shop_id -> solo_cost")

    for shop_id, solo_c in shop_solo_costs.items():
        if not isinstance(solo_c, (int, float)) or solo_c < 0:
            raise ValueError("All shop solo costs must be non-negative numbers")

    if not shop_solo_costs:
        return {}

    total_solo = sum(shop_solo_costs.values())
    total_savings = total_solo - total_pooled_cost

    if allocation_method == "proportional_solo_cost":
        if total_solo == 0:
            equal_share = round(total_savings / len(shop_solo_costs), 2)
            return {shop_id: equal_share for shop_id in shop_solo_costs}
        return {
            shop_id: round(total_savings * (solo_c / total_solo), 2)
            for shop_id, solo_c in shop_solo_costs.items()
        }

    if allocation_method == "equal_split":
        equal_share = round(total_savings / len(shop_solo_costs), 2)
        return {shop_id: equal_share for shop_id in shop_solo_costs}

    raise ValueError(f"Unknown allocation method: {allocation_method}")
