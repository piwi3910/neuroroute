import os
import sys
import json
from pathlib import Path
from datetime import datetime
from loguru import logger
from config import LOG_CONFIG

# Configure Loguru
log_level = LOG_CONFIG["level"]
log_format = LOG_CONFIG["format"]
log_dir = LOG_CONFIG["log_dir"]

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

# Add a JSON sink for structured logging of prompt/response data
json_log_file = Path(log_dir) / f"prompt_data_{datetime.now().strftime('%Y%m%d')}.json"

def log_prompt_data(data: dict):
    """
    Log prompt data and response information to a JSON log file.
    
    Args:
        data: Dictionary containing prompt, response, model, latency, etc.
    """
    with open(json_log_file, "a") as f:
        f.write(json.dumps(data) + "\n")
        
def get_logger():
    """
    Return configured logger
    """
    return logger