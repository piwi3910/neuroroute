# Task: Refactor main.py to remove Dependency Injection

**Status:** Pending
**Coordinator:** TASK-CMD-{{current_date}}-{{current_time}}
**Assigned To:** code
**Goal:** Refactor the `main.py` file to remove the use of FastAPI's Dependency Injection system for core components (Settings, Cache, PromptClassifier, ModelRouter) and instead access these instances directly from `app.state`, where they are initialized during the application lifespan.

**Acceptance Criteria:**
- The dependency functions `get_settings_dependency` and `get_router_dependency` in `main.py` are removed.
- The `Depends` usage and associated type hints for `settings`, `router`, and `logger` parameters in the path operation functions (`process_prompt`, `health_check`, `list_models`, `get_model_health`, `clear_cache`) in `main.py` are removed.
- The `settings`, `router`, `cache`, and `classifier` instances are accessed directly from `app.state` within the path operation functions where they are needed.
- The application starts without errors related to dependency injection or accessing these core components.
- The `/prompt` endpoint can be successfully called with a basic request.

**Context Files:**
- `main.py`
- `router.py`
- `cache.py`
- `config.py`

**Details:**
The core components (Settings, Cache, PromptClassifier, ModelRouter) are already initialized and stored in `app.state` within the `lifespan` function. The goal is to modify the path operation functions to retrieve these instances from `app.state` instead of using `Depends`.

For example, in `process_prompt`, instead of:
```python
async def process_prompt(
    request: PromptRequest,
    background_tasks: BackgroundTasks,
    router: Annotated[ModelRouter, Depends(get_router_dependency)],
    logger: Annotated[Any, Depends(utils.logger.get_logger)]
):
    # ... function body using router and logger
```
It should be refactored to:
```python
async def process_prompt(
    request: PromptRequest,
    background_tasks: BackgroundTasks,
):
    router = request.app.state.router
    logger = request.app.state.logger # Assuming logger is also stored in app.state
    settings = request.app.state.settings # Assuming settings is also stored in app.state
    # ... function body using router, logger, and settings
```
Note that `settings`, `cache`, `classifier`, and `router` are already stored in `app.state` in the `lifespan` function.

**Checklist:**
- [ ] Remove `get_settings_dependency` function.
- [ ] Remove `get_router_dependency` function.
- [ ] Modify `process_prompt` to remove `Depends` and access dependencies from `app.state`.
- [ ] Modify `test_model` to remove `Depends` and access dependencies from `app.state`.
- [ ] Modify `health_check` to remove `Depends` and access dependencies from `app.state`.
- [ ] Modify `list_models` to remove `Depends` and access dependencies from `app.state`.
- [ ] Modify `get_model_capabilities` to remove `Depends` and access dependencies from `app.state`.
- [ ] Modify `clear_cache` to remove `Depends` and access dependencies from `app.state`.
- [ ] Ensure all necessary components are accessed correctly from `app.state` in the refactored functions.
- [ ] Verify the application starts without errors.
- [ ] Verify the `/prompt` endpoint is functional.