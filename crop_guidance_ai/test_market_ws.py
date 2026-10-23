import json
from fastapi import FastAPI
from fastapi.testclient import TestClient
from market_engine import router as market_router, manager

app = FastAPI()
app.include_router(market_router)

def test_market_ws():
    print("Testing FastAPI /ws/market-stream WebSocket endpoint...")
    
    # Pre-populate cache to test initial message delivery
    manager.latest_cache = [
        {"crop_name": "Tomato", "modal_price": 32.5, "arrival_quantity": 1200},
        {"crop_name": "Onion", "modal_price": 28.0, "arrival_quantity": 3400}
    ]

    client = TestClient(app)
    with client.websocket_connect("/ws/market-stream") as websocket:
        # 1. Verify initial cached market state received upon connection
        init_raw = websocket.receive_text()
        init_data = json.loads(init_raw)
        print(f"[OK] Initial snapshot received: type='{init_data.get('type')}', {len(init_data.get('data', []))} items.")
        assert init_data.get("type") == "MARKET_UPDATE"
        assert len(init_data.get("data", [])) == 2

        # 2. Test keepalive ping-pong
        websocket.send_text("ping")
        pong_raw = websocket.receive_text()
        pong_data = json.loads(pong_raw)
        print(f"[OK] Keepalive response received: type='{pong_data.get('type')}' at {pong_data.get('time')}")
        assert pong_data.get("type") == "pong"

    print("[OK] FastAPI /ws/market-stream WebSocket verification 100% SUCCESSFUL!")

if __name__ == "__main__":
    test_market_ws()
