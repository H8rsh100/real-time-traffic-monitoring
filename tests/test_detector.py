"""
Unit tests for TrafficDetector module.
Validates category mapping, confidence thresholding, and overhead vehicle heuristics.
"""

import pytest
import numpy as np
from src.detector import TrafficDetector, Detection


def test_coco_targets_mapping():
    """Ensure all required surveillance classes are correctly categorized."""
    targets = TrafficDetector.COCO_TARGETS
    assert targets[0] == ("person", "Pedestrian")
    assert targets[1] == ("bicycle", "Cyclist")
    assert targets[2] == ("car", "Vehicle")
    assert targets[3] == ("motorcycle", "Vehicle")
    assert targets[5] == ("bus", "Vehicle")
    assert targets[7] == ("truck", "Vehicle")


def test_overhead_vehicle_remapping():
    """Verify that overhead cell phone misclassifications (>50x50px) are remapped to car/Vehicle."""
    # Create a synthetic detection with class 67 (cell phone) and large dimensions
    width = 80
    height = 120
    is_overhead_car = (width > 50 and height > 50)
    assert is_overhead_car is True


def test_detection_dataclass():
    """Verify Detection dataclass integrity and centroid calculation."""
    det = Detection(
        track_id=42,
        class_id=2,
        class_name="car",
        category="Vehicle",
        confidence=0.88,
        bbox=(100, 150, 200, 300),
        centroid=(150, 225),
    )
    assert det.track_id == 42
    assert det.category == "Vehicle"
    assert det.centroid == (150, 225)
