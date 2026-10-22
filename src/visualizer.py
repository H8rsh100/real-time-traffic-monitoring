"""
Computer Vision Visualizer and HUD Overlay module.
Renders high-visibility bounding boxes, class labels, trajectory motion trails,
dynamic glowing counting lines, and a glassmorphic surveillance telemetry HUD.
"""

from typing import Dict, List, Tuple
import cv2
import numpy as np
from src.counter import TrafficCounter
from src.detector import Detection


class Visualizer:
    """
    Renders professional surveillance overlay graphics onto video frames.
    """

    # Distinct, high-contrast BGR colors for primary classes
    CATEGORY_COLORS = {
        "Vehicle": (235, 150, 50),     # Bright Azure / Blue
        "Pedestrian": (70, 210, 110),   # Vivid Emerald Green
        "Cyclist": (20, 180, 245),     # Vibrant Amber / Gold
        "Other": (180, 180, 180),      # Neutral Silver
    }

    CLASS_COLORS = {
        "car": (235, 150, 50),
        "bus": (200, 70, 190),         # Purple
        "truck": (240, 100, 100),      # Teal / Cyan
        "motorcycle": (60, 90, 230),   # Red / Coral
        "person": (70, 210, 110),
        "bicycle": (20, 180, 245),
    }

    def __init__(self, model_tag: str = "YOLOv8n"):
        self.model_tag = model_tag

    def draw_dashboard(
        self,
        frame: np.ndarray,
        detections: List[Detection],
        counter: TrafficCounter,
        fps: float,
        latency_ms: float,
        draw_trails: bool = True,
        draw_roi: bool = True,
    ) -> np.ndarray:
        """
        Render full surveillance overlay onto frame.
        """
        annotated = frame.copy()
        h, w = frame.shape[:2]

        # 1. Draw ROI Zone
        if draw_roi and counter.roi_polygon is not None:
            overlay = annotated.copy()
            cv2.fillPoly(overlay, [counter.roi_polygon], (40, 40, 40))
            cv2.addWeighted(overlay, 0.25, annotated, 0.75, 0, annotated)
            cv2.polylines(
                annotated, [counter.roi_polygon], isClosed=True, color=(120, 220, 120), thickness=2, lineType=cv2.LINE_AA
            )
            # Label ROI
            roi_label_pt = (counter.roi_polygon[0][0] + 10, counter.roi_polygon[0][1] + 25)
            cv2.putText(
                annotated,
                f"MONITORING ZONE [Occupancy: {len(counter.roi_occupants)}]",
                roi_label_pt,
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (140, 240, 140),
                1,
                cv2.LINE_AA,
            )

        # 2. Draw Counting Line
        line_color = (0, 255, 255)  # Yellow default
        thickness = 2
        if len(counter.active_crossings) > 0:
            line_color = (0, 255, 50)  # Flash Vibrant Green on crossing
            thickness = 4

        cv2.line(annotated, counter.line_start, counter.line_end, line_color, thickness, cv2.LINE_AA)

        # Line label tag
        mid_x = (counter.line_start[0] + counter.line_end[0]) // 2
        mid_y = (counter.line_start[1] + counter.line_end[1]) // 2
        line_tag = "COUNTING GATE [v IN / ^ OUT]" if counter.line_orientation == "horizontal" else "COUNTING GATE"
        cv2.putText(
            annotated,
            line_tag,
            (mid_x - 120, mid_y - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.50,
            line_color,
            1,
            cv2.LINE_AA,
        )

        # 3. Draw Trajectory Motion Trails
        if draw_trails:
            for tid, pts in counter.trajectories.items():
                if len(pts) > 1:
                    pts_arr = np.array(list(pts), dtype=np.int32).reshape((-1, 1, 2))
                    cv2.polylines(annotated, [pts_arr], isClosed=False, color=(0, 220, 255), thickness=2, lineType=cv2.LINE_AA)
                    # Draw small centroid circle
                    cv2.circle(annotated, pts[-1], 3, (0, 255, 255), -1)

        # 4. Draw Detections (Boxes + Badges)
        for det in detections:
            x1, y1, x2, y2 = det.bbox
            color = self.CLASS_COLORS.get(det.class_name, self.CATEGORY_COLORS.get(det.category, (200, 200, 200)))

            # Main bounding box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2, cv2.LINE_AA)

            # Modern corner accents for visual flair
            corner_len = min(15, (x2 - x1) // 4, (y2 - y1) // 4)
            if corner_len > 3:
                # Top-Left
                cv2.line(annotated, (x1, y1), (x1 + corner_len, y1), (255, 255, 255), 2)
                cv2.line(annotated, (x1, y1), (x1, y1 + corner_len), (255, 255, 255), 2)
                # Bottom-Right
                cv2.line(annotated, (x2, y2), (x2 - corner_len, y2), (255, 255, 255), 2)
                cv2.line(annotated, (x2, y2), (x2, y2 - corner_len), (255, 255, 255), 2)

            # Label text
            tid_str = f"#{det.track_id} " if det.track_id is not None else ""
            label_text = f"{tid_str}{det.class_name.upper()} {det.confidence:.2f}"

            # Calculate text pill background
            (tw, th), baseline = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            pill_y1 = max(0, y1 - th - 8)
            pill_y2 = y1
            pill_x1 = x1
            pill_x2 = x1 + tw + 10

            cv2.rectangle(annotated, (pill_x1, pill_y1), (pill_x2, pill_y2), color, -1)
            cv2.putText(
                annotated,
                label_text,
                (pill_x1 + 5, pill_y2 - 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (0, 0, 0),
                1,
                cv2.LINE_AA,
            )

        # 5. Top Telemetry HUD Overlay
        self._render_hud(annotated, counter, fps, latency_ms, w)

        return annotated

    def _render_hud(
        self,
        frame: np.ndarray,
        counter: TrafficCounter,
        fps: float,
        latency_ms: float,
        width: int,
    ):
        """Draw semi-transparent glassmorphic top HUD banner."""
        hud_height = 55
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (width, hud_height), (20, 20, 25), -1)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)
        cv2.line(frame, (0, hud_height), (width, hud_height), (60, 60, 75), 1)

        # Left block: Model & Speed
        cv2.putText(
            frame,
            f"LIVE SURVEILLANCE [{self.model_tag}]",
            (15, 22),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.52,
            (0, 220, 255),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            f"FPS: {fps:.1f} | Latency: {latency_ms:.1f} ms",
            (15, 42),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (180, 180, 190),
            1,
            cv2.LINE_AA,
        )

        # Middle block: Traffic Category Breakdown
        veh = counter.counts_by_category.get("Vehicle", 0)
        ped = counter.counts_by_category.get("Pedestrian", 0)
        cyc = counter.counts_by_category.get("Cyclist", 0)

        mid_x = max(240, int(width * 0.35))
        cv2.putText(
            frame,
            f"VEHICLES: {veh}",
            (mid_x, 22),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            self.CATEGORY_COLORS["Vehicle"],
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            f"PEDESTRIANS: {ped}",
            (mid_x + 130, 22),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            self.CATEGORY_COLORS["Pedestrian"],
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            f"CYCLISTS: {cyc}",
            (mid_x + 290, 22),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            self.CATEGORY_COLORS["Cyclist"],
            1,
            cv2.LINE_AA,
        )

        # Sub-stats
        cv2.putText(
            frame,
            f"Active In-Frame: {len(counter.trajectories)} | ROI Occupants: {len(counter.roi_occupants)}",
            (mid_x, 42),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            (210, 210, 220),
            1,
            cv2.LINE_AA,
        )

        # Right block: Total Directional Gate Counts
        right_x = max(width - 190, int(width * 0.78))
        cv2.putText(
            frame,
            f"GATE TOTAL: {counter.total_in + counter.total_out}",
            (right_x, 22),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.50,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            f"IN: {counter.total_in} | OUT: {counter.total_out}",
            (right_x, 42),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (0, 240, 160),
            1,
            cv2.LINE_AA,
        )
