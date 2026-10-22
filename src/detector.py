"""
Object Detection module using Ultralytics YOLOv8.
Handles model loading, inference, confidence filtering, and class categorization.
"""

from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional
import numpy as np
from ultralytics import YOLO


@dataclass
class Detection:
    """Represents a single detected and tracked object."""
    track_id: Optional[int]
    class_id: int
    class_name: str
    category: str
    confidence: float
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    centroid: Tuple[int, int]         # cx, cy


class TrafficDetector:
    """
    YOLOv8-based detector tuned for urban traffic and pedestrian monitoring.
    Filters standard COCO classes into primary surveillance categories.
    """

    # Primary target COCO classes:
    # 0: person, 1: bicycle, 2: car, 3: motorcycle, 5: bus, 7: truck
    COCO_TARGETS = {
        0: ("person", "Pedestrian"),
        1: ("bicycle", "Cyclist"),
        2: ("car", "Vehicle"),
        3: ("motorcycle", "Vehicle"),
        5: ("bus", "Vehicle"),
        7: ("truck", "Vehicle"),
    }

    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        conf_threshold: float = 0.35,
        iou_threshold: float = 0.45,
        target_classes: Optional[List[int]] = None,
        device: str = "cpu",
    ):
        """
        Initialize detector with specified YOLO model and thresholds.
        """
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.target_classes = target_classes or list(self.COCO_TARGETS.keys())
        self.device = device

        print(f"[TrafficDetector] Loading YOLO model: {model_path} on {device}...")
        self.model = YOLO(model_path)
        self.names = self.model.names

    def detect_and_track(
        self,
        frame: np.ndarray,
        persist: bool = True,
        tracker: str = "bytetrack.yaml",
    ) -> Tuple[List[Detection], Dict[str, float]]:
        """
        Perform detection and multi-object tracking on an input frame.

        Returns:
            detections: List of Detection objects with assigned tracking IDs.
            timing: Dictionary of latency in milliseconds (preprocess, inference, postprocess).
        """
        results = self.model.track(
            source=frame,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            classes=self.target_classes,
            persist=persist,
            tracker=tracker,
            verbose=False,
            device=self.device,
        )[0]

        detections: List[Detection] = []
        timing = {
            "preprocess_ms": results.speed.get("preprocess", 0.0),
            "inference_ms": results.speed.get("inference", 0.0),
            "postprocess_ms": results.speed.get("postprocess", 0.0),
        }
        timing["total_ms"] = sum(timing.values())

        boxes = results.boxes
        if boxes is None or len(boxes) == 0:
            return detections, timing

        coords = boxes.xyxy.cpu().numpy().astype(int)
        confidences = boxes.conf.cpu().numpy()
        class_ids = boxes.cls.cpu().numpy().astype(int)
        track_ids = boxes.id.cpu().numpy().astype(int) if boxes.id is not None else [None] * len(coords)

        for bbox, conf, cls_id, tid in zip(coords, confidences, class_ids, track_ids):
            x1, y1, x2, y2 = bbox
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)

            class_name, category = self.COCO_TARGETS.get(
                cls_id, (self.names.get(cls_id, str(cls_id)), "Other")
            )

            detections.append(
                Detection(
                    track_id=int(tid) if tid is not None else None,
                    class_id=cls_id,
                    class_name=class_name,
                    category=category,
                    confidence=float(conf),
                    bbox=(int(x1), int(y1), int(x2), int(y2)),
                    centroid=(cx, cy),
                )
            )

        return detections, timing
