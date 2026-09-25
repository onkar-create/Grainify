"""
Password hashing and signed access tokens for Grainify's officer/viewer login.

Uses a minimal HMAC-SHA256 signed token (not the PyJWT library) because this
environment's system-installed PyJWT drags in a broken `cryptography` package
(missing compiled _cffi_backend) even though we only ever need HS256. This
keeps the same shape as a JWT (base64url payload + signature) without that
fragile dependency chain.
"""
import base64
import hashlib
import hmac
import json
import os
import time

import bcrypt

SECRET_KEY = os.environ.get("GRAINIFY_SECRET_KEY", "dev-secret-change-in-production")
ACCESS_TOKEN_EXPIRE_SECONDS = 60 * 60 * 24  # 1 day


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def create_access_token(subject: str) -> str:
    payload = {"sub": subject, "exp": time.time() + ACCESS_TOKEN_EXPIRE_SECONDS}
    payload_b64 = _b64url_encode(json.dumps(payload).encode("utf-8"))
    signature = hmac.new(SECRET_KEY.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
    return f"{payload_b64}.{_b64url_encode(signature)}"


def decode_access_token(token: str) -> dict:
    """Raises ValueError on any malformed, tampered, or expired token."""
    try:
        payload_b64, signature_b64 = token.split(".")
    except ValueError:
        raise ValueError("Malformed token")

    expected_signature = hmac.new(
        SECRET_KEY.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256
    ).digest()
    if not hmac.compare_digest(_b64url_encode(expected_signature), signature_b64):
        raise ValueError("Invalid token signature")

    payload = json.loads(_b64url_decode(payload_b64))
    if payload["exp"] < time.time():
        raise ValueError("Token expired")
    return payload
