"""
AWS S3 Cloud Storage Client.
Handles document uploads, presigned URLs, and automated data backups.
"""
import os
import boto3
from botocore.exceptions import ClientError
from pathlib import Path
from typing import Optional, Dict, Any, List

from app.core.config import get_settings

settings = get_settings()


class S3StorageClient:
    """Manages S3 operations for document uploads and database snapshot backups."""

    def __init__(self):
        self.bucket_name = settings.AWS_S3_BUCKET_NAME
        self.region = settings.AWS_REGION
        self.access_key = settings.AWS_ACCESS_KEY_ID
        self.secret_key = settings.AWS_SECRET_ACCESS_KEY
        self._client = None

    def _get_client(self):
        if self._client is None and self.is_configured():
            self._client = boto3.client(
                "s3",
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region,
            )
        return self._client

    def is_configured(self) -> bool:
        return bool(
            self.access_key
            and self.secret_key
            and len(self.access_key) > 5
            and self.bucket_name
        )

    def upload_file(
        self,
        local_path: str,
        s3_key: str,
        content_type: Optional[str] = None,
        extra_metadata: Optional[Dict[str, str]] = None,
    ) -> Optional[str]:
        """
        Uploads a local file to S3.
        Returns the S3 URI (s3://bucket/key) on success.
        """
        if not self.is_configured():
            print("[S3Storage] S3 is not configured, skipping upload.")
            return None

        client = self._get_client()
        extra_args: Dict[str, Any] = {}
        if content_type:
            extra_args["ContentType"] = content_type
        if extra_metadata:
            extra_args["Metadata"] = extra_metadata

        try:
            client.upload_file(
                Filename=local_path,
                Bucket=self.bucket_name,
                Key=s3_key,
                ExtraArgs=extra_args if extra_args else None,
            )
            s3_uri = f"s3://{self.bucket_name}/{s3_key}"
            print(f"[S3Storage] Uploaded {local_path} -> {s3_uri}")
            return s3_uri
        except Exception as e:
            print(f"[S3Storage] Failed to upload file to S3: {e}")
            return None

    def upload_bytes(
        self,
        data_bytes: bytes,
        s3_key: str,
        content_type: Optional[str] = None,
    ) -> Optional[str]:
        """Uploads raw bytes directly to S3."""
        if not self.is_configured():
            return None

        client = self._get_client()
        kwargs: Dict[str, Any] = {
            "Bucket": self.bucket_name,
            "Key": s3_key,
            "Body": data_bytes,
        }
        if content_type:
            kwargs["ContentType"] = content_type

        try:
            client.put_object(**kwargs)
            return f"s3://{self.bucket_name}/{s3_key}"
        except Exception as e:
            print(f"[S3Storage] Failed to upload bytes to S3: {e}")
            return None

    def generate_presigned_url(self, s3_key: str, expiry_seconds: int = 3600) -> Optional[str]:
        """Generates a secure, temporary download URL for an S3 object."""
        if not self.is_configured():
            return None

        client = self._get_client()
        try:
            url = client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": s3_key},
                ExpiresIn=expiry_seconds,
            )
            return url
        except Exception as e:
            print(f"[S3Storage] Failed to generate presigned URL: {e}")
            return None

    def download_file(self, s3_key: str, local_path: str) -> bool:
        """Downloads an object from S3 to a local file path."""
        if not self.is_configured():
            return False

        client = self._get_client()
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)
        try:
            client.download_file(
                Bucket=self.bucket_name,
                Key=s3_key,
                Filename=local_path,
            )
            return True
        except Exception as e:
            print(f"[S3Storage] Download error for {s3_key}: {e}")
            return False

    def restore_data_from_s3(self, local_data_dir: Path, s3_key_prefix: str = "data_backups") -> int:
        """
        Restores database files and metadata registries from S3 backup prefix
        into the local data directory if missing locally.
        """
        if not self.is_configured():
            return 0

        client = self._get_client()
        restored_count = 0
        try:
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self.bucket_name, Prefix=s3_key_prefix):
                for obj in page.get("Contents", []):
                    key = obj["Key"]
                    rel_name = key[len(s3_key_prefix):].lstrip("/")
                    if not rel_name:
                        continue

                    # Target local path
                    if rel_name.endswith(".db") and not rel_name.startswith("study_store"):
                        target_path = local_data_dir / "sessions" / rel_name
                    elif rel_name == "sessions_registry.json":
                        target_path = local_data_dir / "sessions" / rel_name
                    else:
                        target_path = local_data_dir / rel_name

                    if not target_path.exists():
                        success = self.download_file(key, str(target_path))
                        if success:
                            restored_count += 1
                            print(f"[S3Storage] Restored {key} -> {target_path}")

        except Exception as e:
            print(f"[S3Storage] Data restore error: {e}")

        return restored_count


# Global singleton instance
s3_storage = S3StorageClient()
