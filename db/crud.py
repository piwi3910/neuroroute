from sqlalchemy.orm import Session
from . import models
from typing import Dict, Any, List, Optional


def get_api_key(db: Session, api_key_id: int):
    """
    Get API key by ID.
    """
    return db.query(models.ApiKey).filter(models.ApiKey.id == api_key_id).first()


def get_api_key_by_provider(db: Session, provider: str):
    """
    Get API key by provider.
    """
    return db.query(models.ApiKey).filter(models.ApiKey.provider == provider).first()


def get_api_keys(db: Session, skip: int = 0, limit: int = 100):
    """
    Get all API keys.
    """
    return db.query(models.ApiKey).offset(skip).limit(limit).all()


def create_api_key(db: Session, api_key: Dict[str, Any]):
    """
    Create a new API key.
    """
    db_api_key = models.ApiKey(
        provider=api_key.provider,
        api_key=api_key.api_key,
        is_active=api_key.is_active
    )
    db.add(db_api_key)
    db.commit()
    db.refresh(db_api_key)
    return db_api_key


def update_api_key(db: Session, api_key_id: int, api_key: Dict[str, Any]):
    """
    Update an existing API key.
    """
    db_api_key = get_api_key(db, api_key_id)
    if db_api_key:
        db_api_key.provider = api_key.provider
        db_api_key.api_key = api_key.api_key
        db_api_key.is_active = api_key.is_active
        db.commit()
        db.refresh(db_api_key)
    return db_api_key


def delete_api_key(db: Session, api_key_id: int):
    """
    Delete an API key.
    """
    db_api_key = get_api_key(db, api_key_id)
    if db_api_key:
        db.delete(db_api_key)
        db.commit()
    return db_api_key


def get_api_key_settings_by_id(db: Session, api_key_settings_id: int):
    """
    Get API key settings by ID.
    """
    return db.query(models.ApiKeySettings).filter(
        models.ApiKeySettings.id == api_key_settings_id
    ).first()


def get_api_key_settings_by_provider(db: Session, provider: str):
    """
    Get API key settings by provider.
    """
    return db.query(models.ApiKeySettings).filter(
        models.ApiKeySettings.provider == provider
    ).first()


def get_api_key_settings(db: Session, skip: int = 0, limit: int = 100):
    """
    Get all API key settings.
    """
    return db.query(models.ApiKeySettings).offset(skip).limit(limit).all()


def create_api_key_settings(db: Session, settings: Dict[str, Any]):
    """
    Create new API key settings.
    """
    db_settings = models.ApiKeySettings(
        provider=settings.provider,
        model=settings.model,
        organization=settings.organization,
        api_base=settings.api_base
    )
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    return db_settings


def update_api_key_settings(db: Session, settings_id: int, settings: Dict[str, Any]):
    """
    Update existing API key settings.
    """
    db_settings = get_api_key_settings_by_id(db, settings_id)
    if db_settings:
        db_settings.provider = settings.provider
        db_settings.model = settings.model
        db_settings.organization = settings.organization
        db_settings.api_base = settings.api_base
        db.commit()
        db.refresh(db_settings)
    return db_settings


def delete_api_key_settings(db: Session, settings_id: int):
    """
    Delete API key settings.
    """
    db_settings = get_api_key_settings_by_id(db, settings_id)
    if db_settings:
        db.delete(db_settings)
        db.commit()
    return db_settings