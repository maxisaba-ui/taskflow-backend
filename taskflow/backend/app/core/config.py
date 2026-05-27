from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = ""
    SECRET_KEY: str = "clave-secreta-default"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    ENVIRONMENT: str = "development"
    TIMEZONE: str = "America/Argentina/Buenos_Aires"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
