# 🌾 AgriAssist: The Ultimate AI-Powered Farming Ecosystem

AgriAssist is a state-of-the-art agricultural intelligence platform designed to bridge the gap between traditional farming and modern AI technology. It provides farmers with precision tools for disease detection, market intelligence, and automated advisory.

---

## 🚀 Key Modules & Features

### 1. AI Crop Disease Scanner
- **Reality-Check Accuracy**: Uses **Google Gemini 2.0 Flash** for multi-stage visual diagnostics.
- **Auto-Detection**: Identifies 15+ crop types and dozens of diseases automatically from a single photo.
- **Live Diagnostics**: Built-in camera integration with real-time feedback.

### 2. Quantum Crop Intelligence
- **Predictive Engine**: Embedded quantum modeling for analyzing field-level data and predicting future yields.
- **Seamless Integration**: Fully embedded Streamlit engine for advanced analytics.

### 3. AI Crop Guidance (FastAPI Backend)
- **Soil & Crop Analysis**: Tailored recommendations based on specific soil data.
- **Market Intel**: Predicts crop profitability and identifies optimal selling strategies.
- **AI Chatbot**: 24/7 agricultural assistant powered by **Groq LLM**.

### 4. Smart Trading (Demand & Supply)
- **Market Awareness**: Real-time tracking of demand from bulk buyers.
- **Direct Commitment**: Farmers can commit their harvest directly to verified buyers.

---

## 🛠️ Full Setup Instructions

### 1. Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [Python](https://www.python.org/) (v3.9 or higher)
- [Supabase CLI](https://supabase.com/docs/guides/resources/supabase-cli)

---

### 2. Frontend Development (React + Vite)

The frontend is built with React, TypeScript, and Tailwind CSS.

```bash
# Install core dependencies
npm install

# Run the development environment
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run unit tests
npm run test
```
*Frontend URL: `http://localhost:8080`*

---

### 3. AI Advisory Backend (FastAPI)

The advisory module handles heavy data processing and LLM integrations.

```bash
# Navigate to backend directory
cd crop_guidance_ai

# Setup Virtual Environment (Recommended)
python -m venv venv
# Activate on Windows:
.\venv\Scripts\activate
# Activate on Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Generate Initial Market Data
python generate_data.py

# Launch the API Server
uvicorn main:app --reload --port 8000
```
*Backend API Docs: `http://localhost:8000/docs`*

---

### 4. Supabase Intelligence (Edge Functions)

The Crop Scanner runs on high-performance serverless functions.

```bash
# Login to Supabase
supabase login

# Deploy the Disease Scanning Function
supabase functions deploy crop-disease-scan

# Set AI Secrets (Required for Gemini)
supabase secrets set LOVABLE_API_KEY=your_gemini_api_key_here
```

---

## � System Architecture

```text
├── src/                    # Frontend: React Application
│   ├── pages/              # Main Dashboard views
│   ├── components/         # Reusable UI elements
│   └── integrations/       # Supabase client & SDKs
├── crop_guidance_ai/       # Backend: Python FastAPI Microservice
│   ├── main.py             # API Endpoints
│   ├── market_engine.py    # Analytics Logic
│   └── datasets/           # Local CSV/DB training data
└── supabase/               # Backend-as-a-Service
    └── functions/          # Gemini-powered Edge Functions
```

---

## 📄 License & Notes
- Developed for the **Smart Farmer Innovation Hackathon**.
- **Important**: Ensure your `.env` files are configured in both the frontend and `crop_guidance_ai` directories with the respective API keys.

---
*Created by Antigravity AI Engine for AgriAssist.*
