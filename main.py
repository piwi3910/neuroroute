import os
import time
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List, Literal
import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from contextlib import asynccontextmanager

from config import get_settings, get_model_registry, Settings
from router import get_router, ModelRouter, ModelNotAvailableError, AllModelsFailedError
from cache import get_cache, Cache
from classifier import get_classifier
import utils.logger

# Initialize logger
logger = utils.logger.get_logger()

# Define lifespan context manager for startup and shutdown events


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize resources and log application start
    settings = get_settings()
    app.state.settings = settings
    logger.info(f"Starting NeuroRoute API v{settings.api.app_version}")

    # Create necessary directories
    os.makedirs("logs", exist_ok=True)

    # Initialize cache, classifier, and router
    app.state.cache = get_cache(logger, settings)
    app.state.classifier = get_classifier(settings)
    app.state.router = get_router(
        settings, app.state.classifier, app.state.cache)
    app.state.logger = logger  # Add logger to app.state

    # Check model health during startup
    try:
        health_status = await app.state.router.get_health_status()
        if health_status["status"] == "unhealthy":
            logger.warning(
                f"Starting with unhealthy models: {json.dumps(health_status['models'])}")
        else:
            logger.info("All models are healthy")
    except Exception as e:
        logger.error(f"Error checking model health during startup: {e}")

    yield

    # Shutdown: close resources
    logger.info("Shutting down NeuroRoute API")
    try:
        # Close router and cache resources
        if hasattr(app.state, 'router') and app.state.router:
            await app.state.router.close()
            logger.info("Successfully closed router resources")
        if hasattr(app.state, 'cache') and app.state.cache:
            await app.state.cache.close()
            logger.info("Successfully closed cache resources")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

# Initialize FastAPI app
# Get settings once to avoid multiple calls
settings = get_settings()

app = FastAPI(
    title="NeuroRoute",
    description="Intelligent LLM Router API that forwards prompts to the best-suited LLM backend based on intent, complexity, and required features",
    # Provide a default version if not set
    version=settings.api.app_version or "0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Compress responses larger than 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Create API routers
main_router = APIRouter(tags=["core"])
model_router = APIRouter(prefix="/models", tags=["models"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])

# Define request and response models


class Metadata(BaseModel):
    user_id: Optional[str] = Field(
        None, description="User identifier for tracking")
    priority: Optional[Literal["speed", "quality", "cost"]] = Field(
        None, description="Priority for model selection: 'speed', 'quality', or 'cost'"
    )
    max_tokens: Optional[int] = Field(
        None, description="Maximum tokens to generate", ge=1)
    temperature: Optional[float] = Field(
        None, description="Temperature for generation", ge=0.0, le=1.0)
    model: Optional[str] = Field(
        None, description="Force specific model: 'local', 'openai', 'anthropic'")
    timeout: Optional[float] = Field(
        None, description="Request timeout in seconds", ge=0.1, le=300)
    use_cache: Optional[bool] = Field(
        True, description="Whether to use cache for this request")
    request_id: Optional[str] = Field(
        None, description="Custom request ID for tracking")

    model_config = ConfigDict(
        extra="allow",  # Allow extra fields for future extensibility and model-specific parameters
    )


class PromptRequest(BaseModel):
    prompt: str = Field(...,
                        description="The prompt to be routed to an LLM", min_length=1)
    metadata: Optional[Metadata] = Field(
        default_factory=Metadata, description="Optional metadata for the request")

    @field_validator('prompt')
    @classmethod
    def validate_prompt_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Prompt cannot be empty")
        return v

    @model_validator(mode='after')
    def set_request_id(self) -> 'PromptRequest':
        if self.metadata and not self.metadata.request_id:
            self.metadata.request_id = f"req_{uuid.uuid4().hex[:8]}_{int(time.time())}"
        return self


class TokenUsage(BaseModel):
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None


class PromptResponse(BaseModel):
    model_used: str = Field(...,
                            description="The model that was used to generate the response")
    response: str = Field(...,
                          description="The generated response from the LLM")
    latency_ms: int = Field(
        ..., description="The time taken to generate the response in milliseconds")
    request_id: str = Field(...,
                            description="Unique identifier for this request")
    token_usage: Optional[TokenUsage] = Field(
        None, description="Token usage statistics")
    from_cache: Optional[bool] = Field(
        None, description="Whether the response was retrieved from cache")
    classification: Optional[Dict[str, Any]] = Field(
        None, description="Classification data if available")
    cache_latency_ms: Optional[int] = Field(
        None, description="Latency for cache lookup in milliseconds")
    fallback: Optional[bool] = Field(
        None, description="Whether a fallback model was used")
    fallback_reason: Optional[str] = Field(
        None, description="Reason for using fallback model")
    model_name: Optional[str] = Field(
        None, description="Specific model name used")
    timestamp: Optional[float] = Field(
        default_factory=time.time, description="Timestamp when response was generated")

    model_config = ConfigDict(
        extra="allow",  # Allow extra fields for backward compatibility and model-specific data
    )


class ModelHealth(BaseModel):
    status: str
    last_checked: Optional[str] = None
    error: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class ModelMetrics(BaseModel):
    requests: int
    success_rate: float
    avg_latency_ms: float


class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    capabilities: List[str]
    avg_latency_ms: int
    cost_per_1k_tokens: float
    max_tokens: int
    health: Optional[ModelHealth] = None
    metrics: Optional[ModelMetrics] = None


class ModelsResponse(BaseModel):
    models: List[ModelInfo]
    count: int
    timestamp: float = Field(default_factory=time.time)


class HealthCheck(BaseModel):
    status: Literal["healthy", "unhealthy", "degraded"]
    message: str
    timestamp: str
    version: str
    env: str
    uptime_seconds: float
    models: Dict[str, ModelHealth]
    metrics: Optional[Dict[str, ModelMetrics]] = None


class ErrorResponse(BaseModel):
    detail: str
    timestamp: float
    request_id: Optional[str] = None
    code: Optional[str] = None

# Request ID middleware


@app.middleware("http")
async def add_request_id_middleware(request: Request, call_next):
    # Generate request ID if not present
    # Generate request ID if not present, otherwise use the one from the header
    request_id = request.headers.get("X-Request-ID")
    if not request_id:
        request_id = f"req_{uuid.uuid4().hex[:8]}_{int(time.time())}"

    # Add request ID to request state
    request.state.request_id = request_id

    # Process the request
    try:
        response = await call_next(request)
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception as e:
        # Create a proper error response with the request ID
        request_id = getattr(request.state, "request_id",
                             "unknown")  # Get request_id from state
        logger.error(f"[{request_id}] Unhandled exception: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "detail": f"Internal server error: {str(e)}",
                "timestamp": time.time(),
                "request_id": request_id,
                "code": "internal_error"
            }
        )

# Global exception handler for better error responses


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"[{request_id}] Global exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Internal server error: {str(exc)}",
            "timestamp": time.time(),
            "request_id": request_id,
            "code": "internal_error"
        }
    )


@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    """Add timestamp and request ID to HTTP exceptions"""
    request_id = getattr(request.state, "request_id", "unknown")

    # Create enhanced error response
    content = {
        "detail": exc.detail,
        "timestamp": time.time(),
        "request_id": request_id
    }

    # Add headers from the original exception
    headers = dict(exc.headers) if exc.headers else {}
    headers["X-Request-ID"] = request_id

    return JSONResponse(
        content=content,
        status_code=exc.status_code,
        headers=headers
    )

# Special exception handlers for router-specific errors


@app.exception_handler(ModelNotAvailableError)
async def model_not_available_handler(request: Request, exc: ModelNotAvailableError):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.warning(f"[{request_id}] Model not available: {exc}")
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": str(exc),
            "timestamp": time.time(),
            "request_id": request_id,
            "code": "model_unavailable"
        }
    )


@app.exception_handler(AllModelsFailedError)
async def all_models_failed_handler(request: Request, exc: AllModelsFailedError):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"[{request_id}] All models failed: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": str(exc),
            "timestamp": time.time(),
            "request_id": request_id,
            "code": "all_models_failed"
        }
    )

# Core routing endpoints


@main_router.post("/prompt", response_model=PromptResponse, response_model_exclude_unset=True)
async def process_prompt(
    request: Request,
    prompt_request: PromptRequest,
    background_tasks: BackgroundTasks,
):
    router: ModelRouter = request.app.state.router
    settings: Settings = request.app.state.settings
    logger: Any = request.app.state.logger  # Define logger here
    """
    Process a prompt and route it to the most appropriate LLM backend.
    
    The router will:
    1. Analyze the prompt to determine the most suitable model
    2. Check for cached responses
    3. Forward the prompt to the selected model
    4. Return the standardized response
    
    You can influence model selection through metadata options:
    - **priority**: Set to "speed" for faster responses, "quality" for better results, or "cost" for lower token usage
    - **model**: Force a specific model ("local", "openai", "anthropic")
    - **max_tokens**: Limit the maximum tokens in the response
    - **temperature**: Control randomness (0.0-1.0)
    """
    # Get the request ID from request.state
    request_id = request.state.request_id
    logger.info(
        f"[{request_id}] Received prompt request: {prompt_request.prompt[:50]}...")

    try:
        # Convert Pydantic model to dict
        metadata = prompt_request.metadata.model_dump(
            exclude_none=True) if prompt_request.metadata else {}

        # Route the prompt to the appropriate model
        result = await router.route_prompt(prompt_request.prompt, metadata)

        # Handle potential errors from the router
        if result.get("error", False):
            # Add background task to log the error
            background_tasks.add_task(
                utils.logger.log_prompt_data,
                {
                    "timestamp": time.time(),
                    "request_id": request_id,
                    "prompt": request.prompt,
                    "metadata": metadata,
                    "error": result.get("response", "Unknown error"),
                    "model_used": result.get("model_used", "unknown")
                },
                get_settings()
            )
            # Choose appropriate status code based on error
            if "timeout" in result.get("response", "").lower():
                status_code = status.HTTP_504_GATEWAY_TIMEOUT
                code = "request_timeout"
            else:
                status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
                code = "model_error"

            raise HTTPException(
                status_code=status_code,
                detail=result["response"],
                headers={"X-Error-Code": code}
            )

        # Add timestamp to the result
        if "timestamp" not in result:
            result["timestamp"] = time.time()

        return result
    except HTTPException:
        # Re-raise HTTP exceptions to be handled by the exception handler
        raise
    except Exception as e:
        logger.error(f"[{request_id}] Error processing prompt: {e}")
        # Add background task to log the error
        background_tasks.add_task(
            utils.logger.log_prompt_data,
            {
                "timestamp": time.time(),
                "request_id": request_id,
                "prompt": prompt_request.prompt,
                "metadata": prompt_request.metadata.model_dump(exclude_none=True) if prompt_request.metadata else {},
                "error": str(e)
            },
            get_settings()
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process prompt: {str(e)}",
            headers={"X-Error-Code": "processing_error"}
        )


@main_router.post("/test-model/{model_key}", response_model=PromptResponse, response_model_exclude_unset=True)
async def test_model(
    request: Request,
    model_key: str,
    prompt_request: PromptRequest,
    background_tasks: BackgroundTasks,
):
    router: ModelRouter = request.app.state.router
    logger: Any = request.app.state.logger
    """
    Test a specific model directly, bypassing the routing logic.
    
    This endpoint is useful for:
    - Testing model availability
    - Comparing responses between different models
    - Debugging model-specific issues
    
    Args:
        model_key: The model to test (local, openai, anthropic)
        request: The prompt request with the same structure as the main endpoint
    """
    request_id = request.metadata.request_id if request.metadata else None
    logger.info(
        f"[{request_id}] Testing model {model_key}: {request.prompt[:50]}...")

    try:
        # Convert Pydantic model to dict
        metadata = request.metadata.model_dump(
            exclude_none=True) if request.metadata else {}

        # Test the specified model
        result = await router.test_model(model_key, request.prompt, metadata)

        # Handle potential errors
        if result.get("error", False):
            logger.error(
                f"[{request_id}] Error in test-model: {result['response']}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["response"],
                headers={"X-Error-Code": "model_error"}
            )

        return result
    except ModelNotAvailableError as e:
        # This is raised when the model is not available
        logger.warning(f"[{request_id}] Model {model_key} not available: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
            headers={"X-Error-Code": "model_not_found"}
        )
    except Exception as e:
        logger.error(f"[{request_id}] Error testing model {model_key}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error testing model: {str(e)}",
            headers={"X-Error-Code": "test_error"}
        )


@main_router.get("/health", response_model=HealthCheck)
async def health_check(
    request: Request,
    detailed: bool = False
):
    router: ModelRouter = request.app.state.router
    settings: Settings = request.app.state.settings
    """
    Health check endpoint to verify the API and models are running.
    
    Args:
        detailed: Whether to include detailed metrics and model health information
    """
    # Get application start time
    start_time = getattr(app, 'start_time', time.time())
    uptime = time.time() - start_time

    try:
        # Check model health
        health_status = await router.get_health_status()

        # Determine overall status
        if not health_status["models"]:
            status_value = "unhealthy"
            message = "No models available"
        elif all(info.get("status") == "healthy" for info in health_status["models"].values()):
            status_value = "healthy"
            message = "All systems operational"
        elif any(info.get("status") == "healthy" for info in health_status["models"].values()):
            status_value = "degraded"
            message = "Some models are unavailable"
        else:
            status_value = "unhealthy"
            message = "All models are unavailable"

        # Create response
        response = {
            "status": status_value,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "version": settings.app_version,
            "env": os.getenv("ENVIRONMENT", "development"),
            "uptime_seconds": uptime,
            "models": health_status["models"],
        }

        # Add metrics if requested
        if detailed:
            response["metrics"] = health_status.get("metrics", {})

        return response
    except Exception as e:
        logger.error(f"Error checking health: {e}")
        return {
            "status": "degraded",
            "message": f"Health check error: {str(e)}",
            "timestamp": datetime.now().isoformat(),
            "version": settings.app_version,
            "env": os.getenv("ENVIRONMENT", "development"),
            "uptime_seconds": uptime,
            "models": {},
        }

# Model information endpoints


@model_router.get("/", response_model=ModelsResponse)
async def list_models(
    request: Request,
    include_health: bool = False
):
    router: ModelRouter = request.app.state.router
    settings: Settings = request.app.state.settings
    """
    List available models and their capabilities.
    
    Args:
        include_health: Whether to include health status for each model
    """
    models = router.get_available_models()

    # Remove health information if not requested
    if not include_health:
        for model in models:
            if "health" in model:
                del model["health"]
            if "metrics" in model:
                del model["metrics"]

    return {
        "models": models,
        "count": len(models),
        "timestamp": time.time()
    }


@model_router.get("/capabilities")
async def get_model_capabilities(request: Request):
    settings: Settings = request.app.state.settings
    """
    Get detailed information about model capabilities to help clients make better routing decisions.
    
    This endpoint provides a mapping of capabilities to models that support them,
    allowing clients to understand which models can handle specific types of tasks.
    """
    model_registry = get_model_registry(settings)
    capabilities = {}

    # Extract capabilities from all models
    all_capabilities = set()
    for model_config in model_registry.values():
        all_capabilities.update(model_config.get("capabilities", []))

    # Map capabilities to models that support them
    for capability in all_capabilities:
        capabilities[capability] = [
            model_key for model_key, config in model_registry.items()
            if capability in config.get("capabilities", [])
        ]

    return {
        "capabilities": capabilities,
        "models": {k: v.get("name") for k, v in model_registry.items()},
        "timestamp": time.time()
    }


@model_router.get("/{model_key}/health")
async def get_model_health(
    request: Request,
    model_key: str,
):
    router: ModelRouter = request.app.state.router
    """
    Get detailed health information for a specific model.
    
    Args:
        model_key: The model key to check (local, openai, anthropic)
    """
    try:
        health_status = await router.get_health_status()

        if model_key not in health_status["models"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model '{model_key}' not found"
            )

        return {
            "model": model_key,
            "health": health_status["models"][model_key],
            "metrics": health_status.get("metrics", {}).get(model_key, {}),
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking model health for {model_key}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check model health: {str(e)}"
        )

# Admin endpoints


@admin_router.post("/cache/clear", status_code=status.HTTP_200_OK)
async def clear_cache(
    request: Request,
    model: Optional[str] = None
):
    cache: Cache = request.app.state.cache
    router: ModelRouter = request.app.state.router
    """
    Clear the response cache.
    
    Args:
        model: Optional model key to clear only cached responses from a specific model
    """
    try:
        count = await cache.clear(model)
        return {
            "success": True,
            "cleared_entries": count,
            "model": model,
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear cache: {str(e)}"
        )

# Register routers
app.include_router(main_router)
app.include_router(model_router)
app.include_router(admin_router)

# Set start time when app is created
app.start_time = time.time()

if __name__ == "__main__":
    # Run the FastAPI app using Uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
