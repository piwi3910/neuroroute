from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from db import get_db, models, crud

router = APIRouter(
    prefix="/api-keys",
    tags=["API Keys"],
    responses={404: {"description": "Not found"}},
)


class ApiKeyBase(BaseModel):
    provider: str
    api_key: str
    is_active: bool = True


class ApiKeyCreate(ApiKeyBase):
    pass


class ApiKey(ApiKeyBase):
    id: int
    
    class Config:
        from_attributes = True


class ApiKeySettingsBase(BaseModel):
    provider: str
    model: Optional[str] = None
    organization: Optional[str] = None
    api_base: Optional[str] = None


class ApiKeySettingsCreate(ApiKeySettingsBase):
    pass


class ApiKeySettings(ApiKeySettingsBase):
    id: int
    
    class Config:
        from_attributes = True


@router.post("/", response_model=ApiKey, status_code=status.HTTP_201_CREATED)
def create_api_key(api_key: ApiKeyCreate, db: Session = Depends(get_db)):
    """
    Create a new API key.
    """
    # Check if provider already exists
    db_api_key = crud.get_api_key_by_provider(db, provider=api_key.provider)
    if db_api_key:
        # Update existing API key
        return crud.update_api_key(db, db_api_key.id, api_key)
    
    # Create new API key
    return crud.create_api_key(db, api_key)


@router.get("/", response_model=List[ApiKey])
def read_api_keys(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all API keys.
    """
    api_keys = crud.get_api_keys(db, skip=skip, limit=limit)
    return api_keys


@router.get("/{provider}", response_model=ApiKey)
def read_api_key(provider: str, db: Session = Depends(get_db)):
    """
    Get API key by provider.
    """
    db_api_key = crud.get_api_key_by_provider(db, provider=provider)
    if db_api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    return db_api_key


@router.put("/{provider}", response_model=ApiKey)
def update_api_key(provider: str, api_key: ApiKeyCreate, db: Session = Depends(get_db)):
    """
    Update API key.
    """
    db_api_key = crud.get_api_key_by_provider(db, provider=provider)
    if db_api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    return crud.update_api_key(db, db_api_key.id, api_key)


@router.delete("/{provider}", status_code=status.HTTP_204_NO_CONTENT)
def delete_api_key(provider: str, db: Session = Depends(get_db)):
    """
    Delete API key.
    """
    db_api_key = crud.get_api_key_by_provider(db, provider=provider)
    if db_api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    crud.delete_api_key(db, db_api_key.id)
    return None


@router.post("/settings/", response_model=ApiKeySettings, status_code=status.HTTP_201_CREATED)
def create_api_key_settings(settings: ApiKeySettingsCreate, db: Session = Depends(get_db)):
    """
    Create API key settings.
    """
    # Check if provider already exists
    db_settings = crud.get_api_key_settings_by_provider(db, provider=settings.provider)
    if db_settings:
        # Update existing settings
        return crud.update_api_key_settings(db, db_settings.id, settings)
    
    # Create new settings
    return crud.create_api_key_settings(db, settings)


@router.get("/settings/", response_model=List[ApiKeySettings])
def read_api_key_settings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all API key settings.
    """
    settings = crud.get_api_key_settings(db, skip=skip, limit=limit)
    return settings


@router.get("/settings/{provider}", response_model=ApiKeySettings)
def read_api_key_settings_by_provider(provider: str, db: Session = Depends(get_db)):
    """
    Get API key settings by provider.
    """
    db_settings = crud.get_api_key_settings_by_provider(db, provider=provider)
    if db_settings is None:
        raise HTTPException(status_code=404, detail="API key settings not found")
    return db_settings


@router.put("/settings/{provider}", response_model=ApiKeySettings)
def update_api_key_settings(provider: str, settings: ApiKeySettingsCreate, db: Session = Depends(get_db)):
    """
    Update API key settings.
    """
    db_settings = crud.get_api_key_settings_by_provider(db, provider=provider)
    if db_settings is None:
        raise HTTPException(status_code=404, detail="API key settings not found")
    return crud.update_api_key_settings(db, db_settings.id, settings)


@router.delete("/settings/{provider}", status_code=status.HTTP_204_NO_CONTENT)
def delete_api_key_settings(provider: str, db: Session = Depends(get_db)):
    """
    Delete API key settings.
    """
    db_settings = crud.get_api_key_settings_by_provider(db, provider=provider)
    if db_settings is None:
        raise HTTPException(status_code=404, detail="API key settings not found")
    crud.delete_api_key_settings(db, db_settings.id)
    return None