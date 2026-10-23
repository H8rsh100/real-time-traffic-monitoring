"""
Extended Telemetry Export Utility.
Serializes crossing events and trajectory data to GeoJSON and structured analytics formats.
"""

import json
from typing import List, Dict, Any
from src.counter import CrossingEvent


def export_events_to_geojson(events: List[CrossingEvent], output_path: str):
    """
    Export crossing events as a GeoJSON FeatureCollection with spatial point coordinates.
    """
    features: List[Dict[str, Any]] = []

    for ev in events:
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(ev.centroid[0]), float(ev.centroid[1])],
            },
            "properties": {
                "frame_idx": ev.frame_idx,
                "timestamp_sec": ev.timestamp_sec,
                "track_id": ev.track_id,
                "class_name": ev.class_name,
                "category": ev.category,
                "confidence": ev.confidence,
                "direction": ev.direction,
                "bbox": list(ev.bbox),
            },
        }
        features.append(feature)

    geojson_data = {
        "type": "FeatureCollection",
        "features": features,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson_data, f, indent=2)

    return output_path
