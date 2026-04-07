from fastapi import APIRouter, UploadFile, File
import numpy as np
import cv2
from model.predict import predict_gesture

router = APIRouter()

@router.post("/predict")
async def predict(file: UploadFile = File(...)):
    
    contents = await file.read()
    
    np_array = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(np_array, cv2.IMREAD_COLOR)

    result = predict_gesture(image)

    return {"prediction": result}