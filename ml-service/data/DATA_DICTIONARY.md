# KiranaPool Dataset Data Dictionary

## shops.csv
- shop_id: string ID, e.g. "S001"
- lat, lng: float, coordinates in approx Jaipur fictional region, degrees
- open_time, close_time: int, minutes from midnight (e.g. 480 = 8 AM)

## riders.csv
- rider_id: string ID, e.g. "R01"
- start_lat, start_lng: float, starting coords
- capacity: int, parcel units (default 10)
- available_from, available_to: int, minutes from midnight

## orders.csv
- order_id: string ID, e.g. "O00001"
- day: int, simulated day (1-7)
- shop_id: string foreign key to shops
- created_min, ready_min, deadline_min: int, minutes from midnight
- cust_lat, cust_lng: float, customer location coords
- package_load: int, parcels in order (1-5)
- order_status: string, one of ['pending','planned','picked','delivered']

## demand_history.csv
- day: int, simulated day
- shop_id: string foreign key to shops
- interval_start: int, minutes from midnight, start of 30-min interval
- order_count: int, count of orders created in that interval

## travel_time_matrix.csv
- origin_id: string node ID (shops or customers)
- dest_id: string node ID
- travel_time_min: float, minutes including detour factor and noise

## scenario_manifest.json
Contains generation parameters including seeds, day and scenario assignments, rider capacity, cost assumptions, and dataset sizes.

