import asyncio
from app.config import settings
from app.utils.s3_client import S3ClientAdapter

async def main():
    try:
        # Override to ensure it talks to exposed localhost port for MinIO
        settings.s3_endpoint = "http://localhost:9000"
        adapter = S3ClientAdapter()
        
        # Test put object
        await adapter.put_object(
            bucket=settings.s3_bucket,
            key="test/123.txt",
            body=b"Hello World",
            content_type="text/plain"
        )
        print("Success! Uploaded object.")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
