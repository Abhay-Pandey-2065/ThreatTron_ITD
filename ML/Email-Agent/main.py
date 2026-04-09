import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os

app = FastAPI(title="ThreatTron ML Email Agent")

# Determine model path
MODEL_PATH = os.path.join(os.path.dirname(__file__), "phishing_model.pkl")

# Load model on startup
try:
    model = joblib.load(MODEL_PATH)
    print("Model loaded successfully.")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

class EmailAnalysisRequest(BaseModel):
    subject: str = ""
    message: str = ""
    sender: str = ""
    urls: str = ""
    text: str = ""  # If you want to supply raw combined text

class EmailAnalysisResponse(BaseModel):
    risk_score: float
    classification: str

@app.post("/predict", response_model=EmailAnalysisResponse)
def predict(request: EmailAnalysisRequest):
    if not model:
        raise HTTPException(status_code=500, detail="Model is not loaded.")
    
    # Combine all CEAS features naturally if `text` is not independently provided
    if request.text:
        combined_text = request.text
    else:
        combined_text = f"{request.subject} {request.message} has_url_{request.urls} {request.sender}".strip()
        
    if not combined_text:
        raise HTTPException(status_code=400, detail="No email content provided.")

    try:
        prediction = model.predict([combined_text])[0]
        prob = model.predict_proba([combined_text])[0][1]
        
        return EmailAnalysisResponse(
            risk_score=round(prob, 4),
            classification="Phishing" if prediction == 1 else "Legitimate"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def root():
    return {"message": "ThreatTron ML Email Agent is running."}
