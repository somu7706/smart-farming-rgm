import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import math
import random
from datetime import datetime, timedelta
import json
import os
from groq import Groq
from pydantic import BaseModel

engine = create_engine("sqlite:///market_intel.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class MarketPrice(Base):
    __tablename__ = "market_prices"
    id = Column(Integer, primary_key=True, index=True)
    crop_name = Column(String, index=True)
    state = Column(String)
    district = Column(String)
    mandi_name = Column(String)
    min_price = Column(Float)
    max_price = Column(Float)
    modal_price = Column(Float)
    arrival_quantity = Column(Float)
    date_time = Column(DateTime, default=datetime.utcnow)

class HistoricalPrice(Base):
    __tablename__ = "historical_prices"
    id = Column(Integer, primary_key=True, index=True)
    crop_name = Column(String, index=True)
    date = Column(DateTime)
    price = Column(Float)
    demand_index = Column(Float)
    supply_index = Column(Float)
    rainfall_factor = Column(Float)
    season = Column(String)
    festival_flag = Column(Integer)

class DemandSupplyIndex(Base):
    __tablename__ = "demand_supply_index"
    id = Column(Integer, primary_key=True, index=True)
    crop_name = Column(String, index=True)
    region = Column(String)
    demand_score = Column(Float)
    supply_score = Column(Float)
    updated_at = Column(DateTime, default=datetime.utcnow)

class MarketTrend(Base):
    __tablename__ = "market_trends"
    id = Column(Integer, primary_key=True, index=True)
    crop_name = Column(String, index=True)
    daily_change_pct = Column(Float)
    ma_7_day = Column(Float)
    ma_30_day = Column(Float)
    volatility_score = Column(Float)
    trend_direction = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

def seed_history():
    db = SessionLocal()
    has_history = db.query(HistoricalPrice).first()
    if not has_history:
        crops = ["Rice", "Wheat", "Cotton", "Maize", "Sugarcane"]
        for c in crops:
            base_price = random.randint(1500, 4000)
            for i in range(30, 0, -1):
                dt = datetime.utcnow() - timedelta(days=i)
                price = base_price + random.randint(-150, 150)
                req = HistoricalPrice(
                    crop_name=c, date=dt, price=float(price),
                    demand_index=random.randint(40, 90), supply_index=random.randint(40, 90),
                    rainfall_factor=random.uniform(0.5, 1.5), season="Kharif", festival_flag=random.randint(0, 1)
                )
                db.add(req)
        db.commit()
    db.close()

seed_history()

def update_market_data():
    db = SessionLocal()
    crops = ["Rice", "Wheat", "Cotton", "Maize", "Sugarcane"]
    latest_data = []

    for crop in crops:
        hist = db.query(HistoricalPrice).filter(HistoricalPrice.crop_name == crop).order_by(HistoricalPrice.date.desc()).first()
        base_p = hist.price if hist else random.randint(2000, 3000)
        
        new_price = base_p + random.randint(-60, 80)
        
        mp = MarketPrice(
            crop_name=crop, state="Telangana", district="Warangal", mandi_name="Enumamula",
            min_price=new_price - 50, max_price=new_price + 50, modal_price=new_price,
            arrival_quantity=random.randint(100, 500)
        )
        db.add(mp)
        db.commit()
        db.refresh(mp)
        
        mt = db.query(MarketTrend).filter(MarketTrend.crop_name == crop).first()
        if not mt:
            mt = MarketTrend(crop_name=crop)
            db.add(mt)
        
        change_pct = ((new_price - base_p) / base_p) * 100
        mt.daily_change_pct = change_pct
        mt.trend_direction = "Increase" if change_pct > 0 else "Decrease" if change_pct < 0 else "Stable"
        mt.updated_at = datetime.utcnow()
        mt.volatility_score = random.uniform(1.0, 5.0)
        mt.ma_7_day = new_price - change_pct*2
        mt.ma_30_day = new_price - change_pct*5
        
        ds = db.query(DemandSupplyIndex).filter(DemandSupplyIndex.crop_name == crop).first()
        if not ds:
            ds = DemandSupplyIndex(crop_name=crop, region="All")
            db.add(ds)
        ds.demand_score = random.randint(40, 90)
        ds.supply_score = random.randint(40, 90)
        ds.updated_at = datetime.utcnow()

        db.commit()
        
        latest_data.append({
            "crop_name": crop,
            "modal_price": mp.modal_price,
            "daily_change_pct": mt.daily_change_pct,
            "trend_direction": mt.trend_direction,
            "demand_score": ds.demand_score,
            "supply_score": ds.supply_score,
            "volatility": mt.volatility_score,
            "date": datetime.utcnow().strftime("%H:%M:%S")
        })

    db.close()
    
    # Broadcast
    if manager.active_connections:
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = None
        if loop and loop.is_running():
            asyncio.run_coroutine_threadsafe(manager.broadcast(json.dumps({"type": "MARKET_UPDATE", "data": latest_data})), loop)

scheduler = AsyncIOScheduler()
scheduler.add_job(update_market_data, 'interval', seconds=5) # Real-time every 5 seconds for visual effect
scheduler.start()

@router.websocket("/ws/market-stream")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

class PredictionRequest(BaseModel):
    crop_name: str

@router.post("/api/market/predict-price")
def predict_price(req: PredictionRequest):
    db = SessionLocal()
    hist = db.query(MarketPrice).filter(MarketPrice.crop_name == req.crop_name).order_by(MarketPrice.id.desc()).first()
    curr = hist.modal_price if hist else 2000
    db.close()
    
    return {
        "current_price": curr,
        "price_after_7_days": curr * random.uniform(1.01, 1.05),
        "price_after_30_days": curr * random.uniform(0.95, 1.15),
        "price_after_90_days": curr * random.uniform(0.90, 1.25),
        "confidence_score": random.randint(75, 95)
    }

@router.post("/api/market/predict-movement")
def predict_movement(req: PredictionRequest):
    moves = ["Increase", "Decrease", "Stable"]
    probs = [random.randint(50, 90) for _ in range(3)]
    best = max(probs)
    idx = probs.index(best)
    return {
        "movement": moves[idx],
        "probability": best
    }

class StrategyResponse(BaseModel):
    recommendation: str
    optimal_storage_period: str
    expected_profit_gain: float
    reasoning: str

@router.post("/api/market/strategy", response_model=StrategyResponse)
def strategy(req: PredictionRequest):
    groq_api = os.getenv("GROQ_API_KEY")
    client = Groq(api_key=groq_api)
    
    db = SessionLocal()
    hist = db.query(MarketPrice).filter(MarketPrice.crop_name == req.crop_name).order_by(MarketPrice.id.desc()).first()
    curr = hist.modal_price if hist else 2000
    db.close()
    
    pred = curr * random.uniform(0.95, 1.25)
    diff = pred - curr
    storage_cost = 50
    
    if diff > storage_cost:
        rec = "HOLD"
        prompt = f"The price of {req.crop_name} is predicted to increase from {curr:.2f} to {pred:.2f} in 30 days. Explain in ONE short sentence why the farmer should HOLD."
    else:
        rec = "SELL"
        prompt = f"The price of {req.crop_name} is predicted to fall or stay static from {curr:.2f} to {pred:.2f} in 30 days. Explain in ONE short sentence why the farmer should SELL NOW."
        
    try:
        resp = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            max_tokens=60
        )
        reasoning = resp.choices[0].message.content
    except Exception as e:
        reasoning = f"AI Prediction suggests this strategy based on past data trends."
        
    return {
        "recommendation": rec,
        "optimal_storage_period": "30 days" if rec == "HOLD" else "0 days",
        "expected_profit_gain": round(abs(diff), 2),
        "reasoning": reasoning.strip()
    }

@router.post("/api/market/peak-time")
def peak_time(req: PredictionRequest):
    db = SessionLocal()
    hist = db.query(MarketPrice).filter(MarketPrice.crop_name == req.crop_name).order_by(MarketPrice.id.desc()).first()
    curr = hist.modal_price if hist else 2000
    db.close()
    
    days_to_peak = random.randint(5, 45)
    peak_date = datetime.utcnow() + timedelta(days=days_to_peak)
    
    return {
        "predicted_peak_date": peak_date.strftime("%Y-%m-%d"),
        "surge_probability": random.randint(60, 95),
        "expected_peak_price": round(curr * random.uniform(1.05, 1.3), 2)
    }

@router.get("/api/market/live-prices")
def live_prices():
    db = SessionLocal()
    crops = ["Rice", "Wheat", "Cotton", "Maize", "Sugarcane"]
    res = []
    
    for c in crops:
        hist_prices = db.query(HistoricalPrice).filter(HistoricalPrice.crop_name == c).order_by(HistoricalPrice.date.asc()).all()[-30:]
        h_data = [{"date": h.date.strftime("%b %d"), "price": h.price} for h in hist_prices]
        
        mp = db.query(MarketPrice).filter(MarketPrice.crop_name == c).order_by(MarketPrice.id.desc()).first()
        mt = db.query(MarketTrend).filter(MarketTrend.crop_name == c).first()
        ds = db.query(DemandSupplyIndex).filter(DemandSupplyIndex.crop_name == c).first()
        
        res.append({
            "crop_name": c,
            "current_price": mp.modal_price if mp else h_data[-1]["price"],
            "daily_change_pct": mt.daily_change_pct if mt else 0,
            "trend": mt.trend_direction if mt else "Stable",
            "volatility": mt.volatility_score if mt else 0,
            "demand": ds.demand_score if ds else 50,
            "supply": ds.supply_score if ds else 50,
            "history": h_data
        })
    db.close()
    return res
