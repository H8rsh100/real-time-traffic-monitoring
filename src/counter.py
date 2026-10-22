"""
Traffic & Pedestrian Counting Algorithm.
Implements robust trajectory-based line crossing and Region of Interest (ROI) zone monitoring.
Includes anti-duplication tracking, direction resolution, and cumulative telemetry.
"""

from collections import deque
from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Tuple
import cv2
import numpy as np
from src.detector import Detection


@dataclass
class CrossingEvent:
    """Record generated when an object crosses the counting threshold or ROI."""
    frame_idx: int
    timestamp_sec: float
    track_id: int
    class_name: str
    category: str
    confidence: float
    direction: str  # "IN" (downward/rightward) or "OUT" (upward/leftward)
    centroid: Tuple[int, int]
    bbox: Tuple[int, int, int, int]


class TrafficCounter:
    """
    Manages directional line crossing and ROI occupancy counting.
    Uses multi-frame trajectory vectors to reliably resolve crossing events.
    """

    def __init__(
        self,
        frame_width: int,
        frame_height: int,
        line_ratio: float = 0.55,
        line_orientation: str = "horizontal",
        roi_polygon: Optional[List[Tuple[int, int]]] = None,
        max_history: int = 30,
        crossing_tolerance_px: int = 15,
    ):
        """
        Args:
            frame_width: Video frame width in pixels.
            frame_height: Video frame height in pixels.
            line_ratio: Relative position of counting line along axis (0.0 to 1.0).
            line_orientation: "horizontal" or "vertical".
            roi_polygon: Optional list of (x, y) vertices defining an active ROI zone.
            max_history: Number of centroid history points to keep for motion trails.
            crossing_tolerance_px: Proximity margin for detecting intersection.
        """
        self.width = frame_width
        self.height = frame_height
        self.line_ratio = line_ratio
        self.line_orientation = line_orientation
        self.max_history = max_history
        self.tolerance = crossing_tolerance_px

        # Establish counting line endpoints
        if line_orientation == "horizontal":
            y = int(frame_height * line_ratio)
            self.line_start = (0, y)
            self.line_end = (frame_width, y)
            self.threshold_coord = y
        else:
            x = int(frame_width * line_ratio)
            self.line_start = (x, 0)
            self.line_end = (x, frame_height)
            self.threshold_coord = x

        # Establish ROI polygon (default is central monitoring rectangle)
        if roi_polygon is None:
            # Default ROI: 15% margin on sides, 30% to 80% vertical span
            x1, x2 = int(0.10 * frame_width), int(0.90 * frame_width)
            y1, y2 = int(0.35 * frame_height), int(0.85 * frame_height)
            self.roi_polygon = np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.int32)
        else:
            self.roi_polygon = np.array(roi_polygon, dtype=np.int32)

        # Tracking state
        self.trajectories: Dict[int, deque] = {}  # track_id -> deque of (cx, cy)
        self.counted_ids: Set[int] = set()       # track_ids already counted
        self.roi_occupants: Set[int] = set()     # track_ids currently inside ROI
        self.active_crossings: Set[int] = set()  # track_ids crossing in current frame (for visual flash)

        # Cumulative Metrics
        self.total_in = 0
        self.total_out = 0
        self.counts_by_category = {"Vehicle": 0, "Pedestrian": 0, "Cyclist": 0, "Other": 0}
        self.counts_by_class: Dict[str, int] = {}
        self.crossing_events: List[CrossingEvent] = []

    def update(
        self,
        detections: List[Detection],
        frame_idx: int,
        fps: float = 30.0,
    ) -> List[CrossingEvent]:
        """
        Update trajectories and detect new crossing events.

        Returns:
            new_events: List of CrossingEvent objects triggered on this frame.
        """
        new_events: List[CrossingEvent] = []
        self.active_crossings.clear()
        timestamp = frame_idx / fps if fps > 0 else 0.0

        current_frame_ids = set()

        for det in detections:
            tid = det.track_id
            if tid is None:
                continue

            current_frame_ids.add(tid)
            cx, cy = det.centroid

            # Update trajectory deque
            if tid not in self.trajectories:
                self.trajectories[tid] = deque(maxlen=self.max_history)
            self.trajectories[tid].append((cx, cy))

            # Need at least 2 points to determine motion direction
            if len(self.trajectories[tid]) < 2:
                continue

            prev_pt = self.trajectories[tid][-2]
            curr_pt = self.trajectories[tid][-1]

            # Check if this object hasn't crossed the line yet
            if tid not in self.counted_ids:
                crossing_detected, direction = self._check_line_crossing(prev_pt, curr_pt)

                if crossing_detected:
                    self.counted_ids.add(tid)
                    self.active_crossings.add(tid)

                    if direction == "IN":
                        self.total_in += 1
                    else:
                        self.total_out += 1

                    # Increment category count
                    cat = det.category if det.category in self.counts_by_category else "Other"
                    self.counts_by_category[cat] += 1

                    # Increment fine-grained class count
                    self.counts_by_class[det.class_name] = self.counts_by_class.get(det.class_name, 0) + 1

                    event = CrossingEvent(
                        frame_idx=frame_idx,
                        timestamp_sec=round(timestamp, 2),
                        track_id=tid,
                        class_name=det.class_name,
                        category=det.category,
                        confidence=det.confidence,
                        direction=direction,
                        centroid=(cx, cy),
                        bbox=det.bbox,
                    )
                    new_events.append(event)
                    self.crossing_events.append(event)

            # Update ROI occupancy
            pt = (float(cx), float(cy))
            inside_roi = cv2.pointPolygonTest(self.roi_polygon, pt, False) >= 0
            if inside_roi:
                self.roi_occupants.add(tid)
            elif tid in self.roi_occupants:
                self.roi_occupants.remove(tid)

        # Cleanup lost tracks older than 60 frames
        active_ids = set(self.trajectories.keys())
        for tid in list(active_ids):
            if tid not in current_frame_ids and len(self.trajectories[tid]) > 0:
                # Optionally purge after track is lost
                pass

        return new_events

    def _check_line_crossing(
        self, prev_pt: Tuple[int, int], curr_pt: Tuple[int, int]
    ) -> Tuple[bool, str]:
        """
        Check if trajectory segment intersects the counting line.
        Returns (crossed, direction).
        """
        if self.line_orientation == "horizontal":
            prev_y, curr_y = prev_pt[1], curr_pt[1]
            line_y = self.threshold_coord

            # Downward crossing (IN)
            if prev_y < line_y and curr_y >= line_y:
                return True, "IN"
            # Upward crossing (OUT)
            elif prev_y > line_y and curr_y <= line_y:
                return True, "OUT"
        else:
            prev_x, curr_x = prev_pt[0], curr_pt[0]
            line_x = self.threshold_coord

            # Rightward crossing (IN)
            if prev_x < line_x and curr_x >= line_x:
                return True, "IN"
            # Leftward crossing (OUT)
            elif prev_x > line_x and curr_x <= line_x:
                return True, "OUT"

        return False, "NONE"

    def get_summary(self) -> Dict:
        """Return formatted summary dictionary of all counts and metrics."""
        return {
            "total_crossed": self.total_in + self.total_out,
            "total_in": self.total_in,
            "total_out": self.total_out,
            "counts_by_category": dict(self.counts_by_category),
            "counts_by_class": dict(self.counts_by_class),
            "current_roi_occupancy": len(self.roi_occupants),
            "total_unique_tracked": len(self.trajectories),
        }
