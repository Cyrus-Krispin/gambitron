"""Application configuration. Uses env vars from deployment (systemd, GitHub Actions)."""
import os

DATABASE_URL = os.getenv("DATABASE_URL")
PGN_STORAGE_DIR = os.getenv("PGN_STORAGE_DIR", "data/games")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")
if ALLOWED_ORIGINS and ALLOWED_ORIGINS != "*":
    ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS.split(",")]
else:
    ALLOWED_ORIGINS = ["*"]
