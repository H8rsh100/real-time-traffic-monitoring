"""
Logging and Telemetry module.
Exports structured CSV event logs and JSON analytics summaries.
"""

import csv
import json
import os
from typing import Dict, List
from src.counter import CrossingEvent


class TrafficLogger:
    """
    Handles persisting surveillance metrics and object crossing events to disk.
    """

    CSV_HEADERS = [
        "Event_ID",
        "Timestamp_Sec",
        "Frame_Index",
        "Track_ID",
        "Class_Name",
        "Category",
        "Confidence",
        "Direction",
        "Centroid_X",
        "Centroid_Y",
        "BBox_X1",
        "BBox_Y1",
        "BBox_X2",
        "BBox_Y2",
    ]

    def __init__(self, output_dir: str = "outputs", base_name: str = "traffic_counts_log"):
        self.output_dir = output_dir
        self.base_name = base_name
        os.makedirs(output_dir, exist_ok=True)
        self.csv_path = os.path.join(output_dir, f"{base_name}.csv")
        self.summary_path = os.path.join(output_dir, f"{base_name}_summary.json")

        # Initialize CSV with headers
        with open(self.csv_path, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(self.CSV_HEADERS)

        self.event_counter = 0

    def log_event(self, event: CrossingEvent):
        """Append a single crossing event to CSV log."""
        self.event_counter += 1
        with open(self.csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                self.event_counter,
                event.timestamp_sec,
                event.frame_idx,
                event.track_id,
                event.class_name,
                event.category,
                f"{event.confidence:.3f}",
                event.direction,
                event.centroid[0],
                event.centroid[1],
                event.bbox[0],
                event.bbox[1],
                event.bbox[2],
                event.bbox[3],
            ])

    def log_events(self, events: List[CrossingEvent]):
        """Batch append crossing events."""
        for e in events:
            self.log_event(e)

    def save_summary(self, summary_data: Dict):
        """Save high-level summary telemetry as formatted JSON."""
        with open(self.summary_path, mode="w", encoding="utf-8") as f:
            json.dump(summary_data, f, indent=4)
        print(f"[TrafficLogger] Telemetry summary saved to: {self.summary_path}")
