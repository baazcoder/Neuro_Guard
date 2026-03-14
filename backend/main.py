import os
import pickle
import numpy as np
from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.sequence import pad_sequences
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, desc
from sqlalchemy.ext.declarative import declarative_base
import google.generativeai as genai
from dotenv import load_dotenv
import uvicorn

# --- Configuration ---
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))
MODEL_PATH = os.path.join(BASE_DIR, "student.h5")
TOKENIZER_PATH = os.path.join(BASE_DIR, "tokenizer.pkl")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# --- Gemini Setup (Fixed SDK) ---
gemini_model = None
try:
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel("gemini-2.5-flash")
        print("✅ Gemini AI Loaded (gemini-2.5-flash).")
    else:
        print("⚠️ No Gemini API key found. Using fallback messages.")
except Exception as e:
    print(f"⚠️ Gemini initialization failed: {e}")

# --- FastAPI App ---
app = FastAPI(title="Neuro Guard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Setup ---
DATABASE_URL = "sqlite:///./neuro_guard.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AnalysisEntry(Base):
    __tablename__ = "analysis_entries"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(String)
    predicted_class = Column(String)
    confidence = Column(Float)
    emergency_trigger = Column(Boolean)
    timestamp = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Global Assets ---
model = None
tokenizer = None
labels = ["Anxiety", "Normal", "Depression", "Suicidal", "Stress", "Bipolar", "Personality disorder"]
VALID_LABELS = set(labels)

FALLBACK_TIPS = {
    "Anxiety": "Try a simple 4-7-8 breath: inhale for 4 counts, hold for 7, exhale for 8.",
    "Normal": "You seem to be in a good mental space! Keep nourishing it.",
    "Depression": "Small steps matter. Try to do one tiny enjoyable thing today.",
    "Suicidal": "You are not alone. iCall: 9152987821 | Vandrevala Foundation: 1860-2662-345.",
    "Stress": "Focus only on what you can control. Try writing down your top 3 stressors.",
    "Bipolar": "Routine is your anchor. Try to sleep and wake at consistent times today.",
    "Personality disorder": "Your feelings are valid. Consider grounding yourself with the 5-4-3-2-1 technique.",
    "Uncertain (High Risk)": "Something feels off. Consider talking to someone you trust today.",
    "Error in Analysis": "Take a moment to breathe. Reach out to someone you trust if you need support."
}

# --- Core Logic Functions ---

async def get_wellness_tip(text: str, label: str) -> str:
    if gemini_model:
        try:
            prompt = f"""A user wrote: "{text}". Mental state: {label}. Write a short wellness tip (2-3 sentences) specific to what they mentioned. Be warm and direct."""
            response = gemini_model.generate_content(prompt)
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            print(f"[WellnessTip Error] Failed to get Gemini response: {type(e).__name__}: {e}")
    else:
        print("[WellnessTip] Gemini model not initialized, using fallback")
    return FALLBACK_TIPS.get(label, FALLBACK_TIPS["Normal"])

async def correct_prediction_with_gemini(text: str, model_label: str) -> str:
    if not gemini_model: 
        print("[Correction] Gemini model not available, returning original label")
        return model_label
    try:
        prompt = f"""User text: "{text}". Predicted: {model_label}. Verify and return EXACTLY one label: Anxiety, Normal, Depression, Suicidal, Stress, Bipolar, Personality disorder. Respond with ONLY the label."""
        response = gemini_model.generate_content(prompt)
        if response and response.text:
            corrected = response.text.strip().replace(".", "")
            if corrected in VALID_LABELS:
                return corrected
    except Exception as e:
        print(f"[Correction Error] Failed to correct with Gemini: {type(e).__name__}: {e}")
    return model_label

@app.on_event("startup")
def load_assets():
    global model, tokenizer
    try:
        if os.path.exists(MODEL_PATH): model = load_model(MODEL_PATH)
        if os.path.exists(TOKENIZER_PATH):
            with open(TOKENIZER_PATH, "rb") as f: tokenizer = pickle.load(f)
        print("✅ Brain Initialized.")
    except Exception as e:
        print(f"❌ Initialization Failed: {e}")

# --- API Models ---
class AnalyzeRequest(BaseModel): text: str
class TopPrediction(BaseModel): label: str; confidence: float
class AnalyzeResponse(BaseModel):
    predicted_class: str; confidence: float; emergency_trigger: bool
    top_predictions: list[TopPrediction] = []; wellness_tip: str = ""

# --- Main Endpoint ---
@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest, db: Session = Depends(get_db)):
    if not model or not tokenizer: raise HTTPException(status_code=503, detail="Model not loaded")
    
    raw_text = req.text.lower()
    
    # 1. CRISIS OVERRIDE
    crisis_map = {
        "Suicidal": ['suicide', 'kill myself', 'end it', 'want to die'],
        "Anxiety": ['panic attack', 'can\'t breathe', 'heart racing'],
        "Stress": ['exam', 'deadline', 'overwhelmed']
    }
    for label, keywords in crisis_map.items():
        if any(word in raw_text for word in keywords):
            tip = await get_wellness_tip(req.text, label)
            return await save_and_return(db, req.text, label, 1.0, (label == "Suicidal"), [TopPrediction(label=label, confidence=1.0)], tip)

    # 2. AI PREDICTION
    try:
        sequence = tokenizer.texts_to_sequences([req.text])
        padded = pad_sequences(sequence, maxlen=64, padding='post')
        prediction = model.predict(padded)[0]
        
        boosted = prediction.copy()
        boosted[0] *= 3.0; boosted[2] *= 4.0; boosted[3] *= 8.0; boosted[4] *= 2.5
        
        idx = int(np.argmax(boosted))
        ai_label = labels[idx]
        ai_conf = float(prediction[idx])

        scored = sorted([(labels[i], float(prediction[i])) for i in range(len(labels))], key=lambda x: x[1], reverse=True)
        top3 = [TopPrediction(label=l, confidence=c) for l, c in scored[:3]]

        # 3. SILENT GEMINI CORRECTION (Fixed Assignment)
        ai_label = await correct_prediction_with_gemini(req.text, ai_label)

        # 4. SENSE-CHECK LOGIC
        if ai_label == "Normal" and ai_conf < 0.5:
            if prediction[2] > 0.1 or prediction[3] > 0.1:
                ai_label = "Uncertain (High Risk)"
                emergency = True
            else: emergency = False
        else:
            emergency = True if ai_label in ["Suicidal", "Depression"] else False

        tip = await get_wellness_tip(req.text, ai_label)
        return await save_and_return(db, req.text, ai_label, ai_conf, emergency, top3, tip)

    except Exception as e:
        print(f"Prediction Error: {e}")
        return await save_and_return(db, req.text, "Error in Analysis", 0.0, False, [], FALLBACK_TIPS["Error in Analysis"])

async def save_and_return(db, text, label, conf, emergency, top3=None, tip=""):
    db_entry = AnalysisEntry(text=text, predicted_class=label, confidence=conf, emergency_trigger=emergency)
    db.add(db_entry)
    db.commit()
    return AnalyzeResponse(predicted_class=label, confidence=conf, emergency_trigger=emergency, top_predictions=top3 or [], wellness_tip=tip)

@app.get("/entries")
def get_entries(db: Session = Depends(get_db)):
    entries = db.query(AnalysisEntry).order_by(desc(AnalysisEntry.timestamp)).limit(50).all()
    return [{"id": e.id, "text": e.text, "predicted_class": e.predicted_class, "confidence": e.confidence, "emergency_trigger": e.emergency_trigger, "timestamp": e.timestamp.isoformat() if e.timestamp else None} for e in entries]

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")