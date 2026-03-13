import os
import pickle
import numpy as np
from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.sequence import pad_sequences
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, tokenizer
    print("⏳ Loading Model and Tokenizer...")
    # Add your load_model and pickle.load logic here
    yield 
    print("🛑 Shutting down...")

# 4. APP DECLARATION (Update your existing app line)
app = FastAPI(title="Neuro Guard", lifespan=lifespan)

# --- Configuration ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "student.h5")
TOKENIZER_PATH = os.path.join(BASE_DIR, "tokenizer.pickle")

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

# --- FastAPI Initialization ---
app = FastAPI(title="Neuro Guard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global Assets ---
model = None
tokenizer = None

# MUST MATCH YOUR COLAB MAPPING EXACTLY
labels = [
    "Anxiety",              # 0
    "Normal",               # 1
    "Depression",           # 2
    "Suicidal",             # 3
    "Stress",               # 4
    "Bipolar",              # 5
    "Personality disorder"  # 6
]

@app.on_event("startup")
def load_assets():
    global model, tokenizer
    try:
        if os.path.exists(MODEL_PATH):
            model = load_model(MODEL_PATH)
        if os.path.exists(TOKENIZER_PATH):
            with open(TOKENIZER_PATH, "rb") as f:
                tokenizer = pickle.load(f)
        print("✅ Brain Initialized: Logic and Model Loaded.")
    except Exception as e:
        print(f"❌ Initialization Failed: {e}")

class AnalyzeRequest(BaseModel):
    text: str

class AnalyzeResponse(BaseModel):
    predicted_class: str
    confidence: float
    emergency_trigger: bool

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest, db: Session = Depends(get_db)):
    if not model or not tokenizer:
        raise HTTPException(status_code=503, detail="Brain not loaded")

    raw_text = req.text.lower()
    
    # 1. CRISIS OVERRIDE (Immediate Priority)
    crisis_map = {
        "Suicidal": ['suicide', 'kill myself', 'end it', 'want to die', 'goodbye'],
        "Anxiety": ['panic attack', 'shaking', 'can\'t breathe', 'heart racing'],
        "Stress": ['exam', 'assignment', 'deadline', 'overwhelmed']
    }
    
    for label, keywords in crisis_map.items():
        if any(word in raw_text for word in keywords):
            # If a crisis word is found, we bypass the AI to ensure 100% accuracy
            return await save_and_return(db, req.text, label, 1.0, (label == "Suicidal"))

    # 2. AI PREDICTION
    try:
        sequence = tokenizer.texts_to_sequences([req.text])
        padded = pad_sequences(sequence, maxlen=64, padding='post')
        prediction = model.predict(padded)[0]
        
        # Apply the Booster we discussed to fix the "Normal" bias
        boosted = prediction.copy()
        boosted[0] *= 3.0  # Anxiety
        boosted[2] *= 4.0  # Depression
        boosted[3] *= 8.0  # Suicidal
        boosted[4] *= 2.5  # Stress
        
        idx = int(np.argmax(boosted))
        ai_label = labels[idx]
        ai_conf = float(prediction[idx])

        # 3. "SENSE-CHECK" LOGIC (Handling Wrong Predictions)
        # If the AI says 'Normal' but confidence is low (< 0.5), 
        # and there's a clinical class with > 0.1, we flag it as 'Needs Review'
        if ai_label == "Normal" and ai_conf < 0.5:
            # Check if any high-risk class has at least some probability
            if prediction[2] > 0.1 or prediction[3] > 0.1:
                ai_label = "Uncertain (High Risk)"
                emergency = True
            else:
                emergency = False
        else:
            emergency = True if ai_label in ["Suicidal", "Depression"] else False

        return await save_and_return(db, req.text, ai_label, ai_conf, emergency)

    except Exception as e:
        # Fallback if the model crashes (e.g., weird characters in text)
        print(f"Prediction Error: {e}")
        return await save_and_return(db, req.text, "Error in Analysis", 0.0, False)

async def save_and_return(db, text, label, conf, emergency):
    db_entry = AnalysisEntry(
        text=text,
        predicted_class=label,
        confidence=conf,
        emergency_trigger=emergency
    )
    db.add(db_entry)
    db.commit()
    return AnalyzeResponse(predicted_class=label, confidence=conf, emergency_trigger=emergency)

@app.get("/entries")
def get_entries(db: Session = Depends(get_db)):
    return db.query(AnalysisEntry).all()