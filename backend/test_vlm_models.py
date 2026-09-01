import asyncio
import httpx
from app.rag.vlm_client import _get_active_gemini_key

async def test():
    key = _get_active_gemini_key()
    print("API Key loaded (length):", len(key) if key else 0)
    
    models = [
        "gemini-2.0-flash", 
        "gemini-1.5-flash", 
        "gemini-2.5-flash", 
        "gemini-3.5-flash-lite", 
        "gemini-3.5-flash", 
        "gemini-3.6-flash", 
        "gemini-flash-latest"
    ]
    for m in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={key}"
        payload = {"contents": [{"parts": [{"text": "Hello"}]}]}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(url, json=payload)
                print(f"Model {m}: Status {r.status_code}")
                if r.status_code != 200:
                    print("  Error:", r.text[:120])
        except Exception as e:
            print(f"Model {m} exception: {e}")

if __name__ == "__main__":
    asyncio.run(test())
