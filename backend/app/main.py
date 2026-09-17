import logging
from io import BytesIO

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image

from .inference import detect_road_damage
from .schemas import PredictionResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


app = FastAPI(
    title="Road Damage Detection API",
    description="YOLO11-based Road Damage Detection API",
    version="1.0.0",
)


app.mount(
    "/outputs",
    StaticFiles(directory="outputs"),
    name="outputs",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Road Damage Detection API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }

@app.post(
    "/predict",
    response_model=PredictionResponse,
)
async def predict(file: UploadFile = File(...)):


    if (
        not file.content_type
        or not file.content_type.startswith("image/")
    ):
        logger.warning(
            "Invalid file type uploaded: %s",
            file.filename,
        )

        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image file.",
        )


    try:
        contents = await file.read()

        if not contents:
            logger.warning(
                "Empty file uploaded: %s",
                file.filename,
            )

            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty.",
            )

        image = Image.open(
            BytesIO(contents)
        ).convert("RGB")

    except HTTPException:
        raise

    except Exception as e:
        logger.error(
            "Invalid image %s: %s",
            file.filename,
            e,
        )

        raise HTTPException(
            status_code=400,
            detail="Invalid or corrupted image file.",
        )


    try:
        logger.info(
            "Prediction requested for file: %s",
            file.filename,
        )

        result = detect_road_damage(
            image,
            original_filename=file.filename or "image.jpg",
        )

    except Exception as e:
        logger.error(
            "Prediction failed for %s: %s",
            file.filename,
            e,
        )

        raise HTTPException(
            status_code=500,
            detail="Road damage detection failed.",
        )


    logger.info(
        "Prediction completed for %s. Detections: %d",
        file.filename,
        len(result["detections"]),
    )


    return {
        "filename": file.filename,
        "detections": result["detections"],
        "count": len(result["detections"]),
        "annotated_image": result["annotated_image"],
    }