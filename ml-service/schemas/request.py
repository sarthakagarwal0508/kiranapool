"""Request schemas and payload validation for KiranaPool ML service."""

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field


class RequestBase(BaseModel):
    model_config = ConfigDict(extra="allow")


class RouteRequest(RequestBase):
    orders: List[Dict[str, Any]] = Field(..., description="List of orders to batch and route")


class SolveRouteRequest(RequestBase):
    stops: List[Dict[str, Any]] = Field(..., description="List of stops to sequence")
    start_location: Optional[Union[List[float], tuple]] = Field(None, examples=[[12.9300, 77.6200]])
    algorithm: Optional[str] = Field("auto", examples=["auto"])


class BatchRequest(RequestBase):
    orders: List[Dict[str, Any]] = Field(..., description="List of orders to cluster into batches")
    max_distance_km: Optional[float] = Field(2.0, gt=0, examples=[2.0])
    max_time_window_minutes: Optional[float] = Field(30.0, gt=0, examples=[30.0])
    max_orders_per_batch: Optional[int] = Field(4, gt=0, examples=[4])
    max_weight_kg: Optional[float] = Field(15.0, gt=0, examples=[15.0])


class ForecastRequest(RequestBase):
    shop_id: Optional[str] = Field(None, examples=["shop_1"])
    time_interval: Optional[Any] = Field(None, examples=["09:00-11:00"])
    historical_data: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Optional historical demand records")
    default_forecast: Optional[float] = Field(0.0, ge=0, examples=[0.0])
    horizonDays: Optional[int] = None
    groupBy: Optional[str] = None
    history: List[Dict[str, Any]] = Field(default_factory=list)
    shops: List[Dict[str, Any]] = Field(default_factory=list)
    slots: Optional[List[Dict[str, Any]]] = None


class TravelTimeRequest(RequestBase):
    distance_km: float = Field(..., ge=0, examples=[5.0])
    speed_kmh: Optional[float] = Field(20.0, gt=0, examples=[20.0])
    unit: Optional[str] = Field("minutes", examples=["minutes"])


class CostCalculationRequest(RequestBase):
    solo_distances: Optional[Union[float, List[float]]] = Field(None, examples=[[3.0, 4.5]])
    total_pooled_distance: Optional[float] = Field(None, ge=0, examples=[5.2])
    num_orders: Optional[int] = Field(1, ge=1, examples=[2])
    base_cost: Optional[float] = Field(20.0, ge=0, examples=[20.0])
    cost_per_km: Optional[float] = Field(10.0, ge=0, examples=[10.0])
    cost_per_drop: Optional[float] = Field(5.0, ge=0, examples=[5.0])
    shop_solo_costs: Optional[Dict[str, float]] = Field(None, examples=[{"shop_1": 50.0, "shop_2": 65.0}])
    total_pooled_cost: Optional[float] = Field(None, ge=0, examples=[85.0])
    allocation_method: Optional[str] = Field("proportional_solo_cost", examples=["proportional_solo_cost"])


class DeliveryPlanRequest(RequestBase):
    orders: List[Dict[str, Any]] = Field(..., description="List of orders to plan, batch, route, and calculate economics for")
    start_location: Optional[Union[List[float], tuple]] = Field(None, examples=[[12.9350, 77.6200]])
    max_distance_km: Optional[float] = Field(2.0, gt=0, examples=[2.0])
    max_time_window_minutes: Optional[float] = Field(30.0, gt=0, examples=[30.0])
    max_orders_per_batch: Optional[int] = Field(4, gt=0, examples=[4])
    max_weight_kg: Optional[float] = Field(15.0, gt=0, examples=[15.0])
    speed_kmh: Optional[float] = Field(20.0, gt=0, examples=[20.0])
    base_cost: Optional[float] = Field(20.0, ge=0, examples=[20.0])
    cost_per_km: Optional[float] = Field(10.0, ge=0, examples=[10.0])
    cost_per_drop: Optional[float] = Field(5.0, ge=0, examples=[5.0])
    allocation_method: Optional[str] = Field("proportional_solo_cost", examples=["proportional_solo_cost"])
