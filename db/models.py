from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


class ApiKey(Base):
    """
    Model for storing API keys for different providers.
    """
    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    provider: Mapped[str] = mapped_column(
        String, unique=True, index=True, nullable=False
    )
    api_key: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(onupdate=func.now())

    def __repr__(self):
        return (f"<ApiKey(provider='{self.provider}', "
                f"is_active={self.is_active})>")


class ApiKeySettings(Base):
    """
    Model for storing additional settings for API providers.
    """
    __tablename__ = "api_key_settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    provider: Mapped[str] = mapped_column(
        String, unique=True, index=True, nullable=False
    )
    model: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    organization: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    api_base: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(onupdate=func.now())

    def __repr__(self):
        return (f"<ApiKeySettings(provider='{self.provider}', "
                f"model='{self.model}')>")