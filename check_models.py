import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv('.env')
genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

models_to_test = [
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite-preview-02-05',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
    'gemini-1.0-pro'
]

for model_name in models_to_test:
    try:
        print(f"Testing {model_name}...")
        m = genai.GenerativeModel(model_name)
        response = m.generate_content('hi')
        print(f"✅ Success with {model_name}: {response.text}")
        break# Stop at the first working model
    except Exception as e:
        print(f"❌ Failed with {model_name}: {e}\n")
