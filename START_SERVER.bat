@echo off
cd /d C:\Users\sandh\OneDrive\Documents\Desktop\Neuro_guard
echo Starting Neuro Guard Server...
uvicorn backend.main:app --port 8000 --reload
pause
