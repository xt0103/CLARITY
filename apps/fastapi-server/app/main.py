from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.errors import ApiError, error_payload
from app.api.routes.auth import router as auth_router
from app.api.routes.resumes import router as resumes_router
from app.api.routes.match import router as match_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.applications import router as applications_router
from app.api.routes.metrics import router as metrics_router
from app.api.routes.assistant import router as assistant_router


def _http_code_to_error_code(status_code: int) -> str:
    if status_code == 401:
        return "UNAUTHORIZED"
    if status_code == 403:
        return "FORBIDDEN"
    if status_code == 404:
        return "NOT_FOUND"
    if status_code == 409:
        return "CONFLICT"
    if status_code in (400, 413, 422):
        return "VALIDATION_ERROR"
    return "INTERNAL_ERROR"


def create_app() -> FastAPI:
    app = FastAPI(title="CLARITY Job Seeker API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz")
    def healthz():
        return {"ok": True}

    @app.exception_handler(ApiError)
    def handle_api_error(_req, exc: ApiError):
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(code=exc.code, message=exc.message, details=exc.details),
        )

    @app.exception_handler(RequestValidationError)
    def handle_validation_error(_req, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content=error_payload(
                code="VALIDATION_ERROR",
                message="Validation error",
                details={"errors": exc.errors()},
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    def handle_http_exception(_req, exc: StarletteHTTPException):
        code = _http_code_to_error_code(exc.status_code)
        message = exc.detail if isinstance(exc.detail, str) else "Request error"
        return JSONResponse(status_code=exc.status_code, content=error_payload(code=code, message=message))

    app.include_router(auth_router)
    app.include_router(resumes_router)
    app.include_router(match_router)
    app.include_router(jobs_router)
    app.include_router(applications_router)
    app.include_router(metrics_router)
    app.include_router(assistant_router)

    return app


app = create_app()

