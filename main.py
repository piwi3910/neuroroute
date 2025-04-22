import os
import time
from typing import Dict, Any, Optional
import uvicorn
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from router import router
from utils.logger import get_logger

# Load environment variables
load_dotenv()

# Initialize logger
logger = get_logger()

# Initialize FastAPI app
app = FastAPI(
    title="NeuroRoute",
    description="Intelligent LLM Router API that forwards prompts to the best-suited LLM backend",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define request and response models
class Metadata(BaseModel):
    user_id: Optional[str] = None
    priority: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None

class PromptRequest(BaseModel):
    prompt: str = Field(..., description="The prompt to be routed to an LLM", min_length=1)
    metadata: Optional[Metadata] = Field(default_factory=Metadata, description="Optional metadata for the request")

class TokenUsage(BaseModel):
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None

class PromptResponse(BaseModel):
    model_used: str = Field(..., description="The model that was used to generate the response")
    response: str = Field(..., description="The generated response from the LLM")
    latency_ms: int = Field(..., description="The time taken to generate the response in milliseconds")
    token_usage: Optional[Dict[str, int]] = Field(None, description="Token usage statistics")
    from_cache: Optional[bool] = Field(None, description="Whether the response was retrieved from cache")
    classification: Optional[Dict[str, Any]] = Field(None, description="Classification data if available")

@app.post("/prompt", response_model=PromptResponse)
async def process_prompt(request: PromptRequest):
    """
    Process a prompt and route it to the most appropriate LLM backend.
    
    The router will:
    1. Analyze the prompt to determine the most suitable model
    2. Check for cached responses
    3. Forward the prompt to the selected model
    4. Return the standardized response
    """
    logger.info(f"Received prompt request: {request.prompt[:50]}...")
    
    try:
        # Convert Pydantic model to dict
        metadata = request.metadata.dict(exclude_none=True) if request.metadata else {}
        
        # Route the prompt to the appropriate model
        result = await router.route_prompt(request.prompt, metadata)
        
        # Handle potential errors from the router
        if result.get("error", False):
            raise HTTPException(status_code=500, detail=result["response"])
            
        return result
    except Exception as e:
        logger.error(f"Error processing prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """
    Health check endpoint to verify the API is running.
    """
    return {
        "status": "ok",
        "timestamp": time.time(),
        "version": "0.1.0"
    }

@app.get("/models")
async def list_models():
    """
    List available models and their capabilities.
    """
    from config import MODEL_REGISTRY
    
    models = {}
    for key, config in MODEL_REGISTRY.items():
        models[key] = {
            "name": config.get("name"),
            "provider": config.get("provider"),
            "capabilities": config.get("capabilities", []),
            "max_tokens": config.get("max_tokens"),
        }
    
    return {
        "models": models,
        "count": len(models)
    }

if __name__ == "__main__":
    # Run the FastAPI app using Uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)