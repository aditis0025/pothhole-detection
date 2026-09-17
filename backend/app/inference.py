from pathlib import Path
from datetime import datetime

import cv2
from PIL import Image
from ultralytics import YOLO

from .severity import get_severity


MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "best.pt"

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

model = YOLO(str(MODEL_PATH))


def detect_road_damage(
    image: Image.Image,
    confidence: float = 0.25,
    original_filename: str = "image.jpg",
):
    """
    Run road damage detection on an image and save an annotated image.
    """

    results = model.predict(
        source=image,
        conf=confidence,
        device="cpu",
        verbose=False,
    )

    result = results[0]

    # Generate annotated image with bounding boxes
    annotated_image = result.plot()

    # Create a unique filename using the current timestamp
    original_name = Path(original_filename).stem
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")

    output_filename = f"{original_name}_prediction_{timestamp}.jpg"
    output_path = OUTPUT_DIR / output_filename

    # Save annotated image
    cv2.imwrite(
        str(output_path),
        cv2.cvtColor(annotated_image, cv2.COLOR_RGB2BGR),
    )

    detections = []

    for box in result.boxes:
        class_id = int(box.cls.item())
        class_name = result.names[class_id]
        conf = float(box.conf.item())

        bbox = [
            round(float(x), 2)
            for x in box.xyxy[0].tolist()
        ]

        detections.append(
            {
                "class_id": class_id,
                "damage_type": class_name,
                "severity": get_severity(class_name),
                "confidence": round(conf, 4),
                "bbox": bbox,
            }
        )

    return {
        "detections": detections,
        "annotated_image": str(output_path),
    }