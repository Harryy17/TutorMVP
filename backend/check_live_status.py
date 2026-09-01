import boto3
import httpx
from app.core.config import get_settings
from app.core.s3_client import s3_storage
from app.rag.vlm_client import vlm_client

def check_all():
    settings = get_settings()

    print("==================================================")
    print("LIVE CLOUD & BACKEND CONNECTIVITY STATUS")
    print("==================================================")

    # 1. AWS S3 Check
    print("\n1. [AWS S3 Cloud Storage]")
    try:
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        res = s3.list_objects_v2(Bucket=settings.AWS_S3_BUCKET_NAME, MaxKeys=5)
        print("   Bucket Name :", settings.AWS_S3_BUCKET_NAME)
        print("   Region      :", settings.AWS_REGION)
        print("   Status      : CONNECTED & AUTHENTICATED")
        print("   Objects in S3:", res.get("KeyCount", 0))
        if "Contents" in res:
            print("   Recent S3 Uploads:")
            for item in res["Contents"][:3]:
                print(f"     - {item['Key']} ({item.get('Size', 0)} bytes)")
    except Exception as e:
        print("   Status      : FAILED -", e)

    # 2. Google Gemini VLM Check
    print("\n2. [Google Gemini VLM / LLM]")
    print("   Configured  :", vlm_client.is_configured())
    print("   Model Target: gemini-3.5-flash-lite / gemini-3.5-flash / gemini-3.6-flash")

    # 3. Local Backend Server Check
    print("\n3. [FastAPI Backend Service]")
    try:
        r = httpx.get("http://127.0.0.1:8000/api/health", timeout=5.0)
        print(f"   Status Code : {r.status_code} ({r.json()})")
        print("   Status      : ONLINE & READY")
    except Exception as e:
        print("   Status      : OFFLINE -", e)

    print("\n==================================================")

if __name__ == "__main__":
    check_all()
