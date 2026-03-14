# Neuro Guard

An AI-powered mental health analyzer that uses machine learning to assess mental states from text input and provides personalized wellness tips.

## Features

- **Mental State Analysis**: Analyzes text input to predict mental states including Anxiety, Depression, Stress, Bipolar, Personality Disorder, and more
- **AI-Powered Tips**: Generates personalized wellness tips using Google's Gemini AI
- **Emergency Detection**: Identifies high-risk situations and provides appropriate resources
- **Analysis History**: Stores and displays previous analyses for tracking progress
- **Modern UI**: Clean, glass-morphism design with responsive interface

## Tech Stack

### Backend
- **FastAPI**: High-performance web framework
- **TensorFlow/Keras**: Machine learning model for mental state prediction
- **Google Gemini AI**: For generating personalized wellness tips
- **SQLAlchemy**: Database ORM for storing analysis history
- **SQLite**: Local database for data persistence

### Frontend
- **HTML5/CSS3**: Modern web technologies
- **JavaScript**: Interactive functionality
- **Phosphor Icons**: Beautiful icon library

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Neuro_Guard
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Download model files**:
   Ensure the following files are present in the `backend/` directory:
   - `student.h5` (TensorFlow model)
   - `tokenizer.pkl` (text tokenizer)

## Usage

### Starting the Server

**Windows**:
Double-click `START_SERVER.bat` or run:
```bash
uvicorn backend.main:app --port 8000 --reload
```

**Linux/Mac**:
```bash
uvicorn backend.main:app --port 8000 --reload
```

### Accessing the Application

Open your web browser and navigate to: `http://localhost:8000`

The application will serve both the backend API and frontend interface.

## How It Works

1. **Text Analysis**: User inputs text describing their current mental state or situation
2. **ML Prediction**: TensorFlow model analyzes the text and predicts the most likely mental state
3. **AI Tips**: Google Gemini generates personalized, context-specific wellness advice
4. **Emergency Handling**: High-risk predictions trigger appropriate support resources
5. **History Tracking**: All analyses are stored locally for progress monitoring

## Mental States Detected

- Anxiety
- Normal
- Depression
- Suicidal
- Stress
- Bipolar
- Personality Disorder

## Emergency Resources

For critical situations, the app provides immediate access to:
- iCall: 9152987821
- Vandrevala Foundation: 1860-2662-345

## Development

### Project Structure
```
Neuro_Guard/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── student.h5           # Trained ML model
│   ├── tokenizer.pkl        # Text tokenizer
│   └── hackathon_model.ipynb # Model training notebook
├── frontend/
│   ├── index.html           # Main interface
│   ├── style.css            # Styling
│   └── script.js            # Frontend logic
├── requirements.txt         # Python dependencies
├── START_SERVER.bat         # Windows startup script
└── README.md               # This file
```

### Adding New Features
- Frontend components can be modified in the `frontend/` directory
- Model retraining can be done using `hackathon_model.ipynb`



## Disclaimer

This application is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of qualified health providers with questions about mental health conditions.
