import os
import sys
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from functools import lru_cache
from loguru import logger
from config import get_settings, get_log_config, Settings

# Function to configure and get logger
def setup_logger(settings: Optional[Settings] = None):
    """
    Configure and set up the logger based on settings.
    
    Args:
        settings: Application settings. If None, will use get_settings()
    
    Returns:
        Configured logger instance
    """
    # Use provided settings or get from default
    settings = settings or get_settings()
    log_config = get_log_config(settings)
    
    # Get configuration values
    log_level = log_config["level"]
    log_format = log_config["format"]
    log_dir = log_config["log_dir"]
    
    # Ensure log directory exists
    Path(log_dir).mkdir(exist_ok=True)
    
    # Set up file sink for logs
    log_file = Path(log_dir) / f"neuroroute_{datetime.now().strftime('%Y%m%d')}.log"
    
    # Remove default logger
    logger.remove()
    
    # Add console sink
    logger.add(sys.stderr, level=log_level, format=log_format)
    
    # Add file sink
    logger.add(log_file, level=log_level, format=log_format, rotation="00:00", retention="30 days")
    
    return logger

# Set up the logger with default settings when module is imported
_logger = setup_logger()

# Generate path for JSON log file
def get_json_log_file(settings: Optional[Settings] = None) -> Path:
    """
    Get the path to the JSON log file for prompt data.
    
    Args:
        settings: Application settings
    
    Returns:
        Path to the JSON log file
    """
    settings = settings or get_settings()
    log_config = get_log_config(settings)
    log_dir = log_config["log_dir"]
    
    Path(log_dir).mkdir(exist_ok=True)
    return Path(log_dir) / f"prompt_data_{datetime.now().strftime('%Y%m%d')}.json"

async def log_prompt_data(data: Dict[str, Any], settings: Optional[Settings] = None):
    """
    Log prompt data and response information to a JSON log file.
    Now an async function to support FastAPI background tasks.
    
    Args:
        data: Dictionary containing prompt, response, model, latency, etc.
        settings: Optional settings
    """
    json_log_file = get_json_log_file(settings)
    
    # Add timestamp if not present
    if "timestamp" not in data:
        data["timestamp"] = datetime.now().isoformat()
    
    try:
        with open(json_log_file, "a") as f:
            f.write(json.dumps(data) + "\n")
        _logger.debug(f"Logged prompt data to {json_log_file}")
    except Exception as e:
        _logger.error(f"Failed to log prompt data: {e}")

@lru_cache()
def get_logger():
    """
    Return configured logger instance.
    The lru_cache ensures this is only called once per process.
    
    Returns:
        Configured logger instance
    """
    return _logger