"""
Custom exception hierarchy and FastAPI exception handlers.
"""
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


# ── Exception Classes ─────────────────────────────────────────────────────────

class BrandoraException(Exception):
    """Base exception for Brandora AI."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code: str = "INTERNAL_ERROR"
    message: str = "An unexpected error occurred."

    def __init__(
        self,
        message: Optional[str] = None,
        details: Optional[Any] = None,
    ) -> None:
        self.message = message or self.__class__.message
        self.details = details
        super().__init__(self.message)


class AuthenticationError(BrandoraException):
    status_code = status.HTTP_401_UNAUTHORIZED
    error_code = "AUTHENTICATION_ERROR"
    message = "Authentication failed."


class AuthorizationError(BrandoraException):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "AUTHORIZATION_ERROR"
    message = "You do not have permission to perform this action."


class NotFoundError(BrandoraException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "NOT_FOUND"
    message = "The requested resource was not found."


class ValidationError(BrandoraException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    error_code = "VALIDATION_ERROR"
    message = "Request validation failed."


class AIServiceError(BrandoraException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    error_code = "AI_SERVICE_ERROR"
    message = "The AI service is temporarily unavailable."


class RateLimitError(BrandoraException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    error_code = "RATE_LIMIT_EXCEEDED"
    message = "You have exceeded your generation limit for this billing period."


class SocialPlatformError(BrandoraException):
    status_code = status.HTTP_502_BAD_GATEWAY
    error_code = "SOCIAL_PLATFORM_ERROR"
    message = "Error communicating with the social media platform."


# ── Response Builder ──────────────────────────────────────────────────────────

def _error_response(
    status_code: int,
    error_code: str,
    message: str,
    details: Optional[Any] = None,
) -> JSONResponse:
    content: dict = {"error": error_code, "message": message}
    if details is not None:
        content["details"] = details
    return JSONResponse(status_code=status_code, content=content)


# ── Handler Registration ──────────────────────────────────────────────────────

def register_exception_handlers(app: FastAPI) -> None:
    """Register all custom exception handlers on the FastAPI app."""

    @app.exception_handler(BrandoraException)
    async def brandora_exception_handler(
        request: Request, exc: BrandoraException
    ) -> JSONResponse:
        return _error_response(
            exc.status_code, exc.error_code, exc.message, exc.details
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(
        request: Request, exc: HTTPException
    ) -> JSONResponse:
        return _error_response(
            exc.status_code,
            "HTTP_ERROR",
            str(exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = []
        for error in exc.errors():
            errors.append(
                {
                    "field": " -> ".join(str(loc) for loc in error["loc"]),
                    "message": error["msg"],
                    "type": error["type"],
                }
            )
        return _error_response(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "VALIDATION_ERROR",
            "Request validation failed.",
            errors,
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        import logging

        logging.getLogger("brandora").exception("Unhandled exception: %s", exc)
        return _error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "An unexpected error occurred. Please try again later.",
        )
