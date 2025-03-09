from fastapi import HTTPException, status
from typing import Optional, Dict, Any

class ServiceBusinessException(HTTPException):
    """Base exception class for all application exceptions"""
    def __init__(
        self, 
        status_code: int, 
        detail: str,
        headers: Optional[Dict[str, Any]] = None
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)

class AuthenticationException(ServiceBusinessException):
    """Exception raised for authentication errors"""
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"}
        )

class AuthorizationException(ServiceBusinessException):
    """Exception raised for authorization errors"""
    def __init__(self, detail: str = "Not authorized to perform this action"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )

class NotFoundException(ServiceBusinessException):
    """Exception raised when a resource is not found"""
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )

class ValidationException(ServiceBusinessException):
    """Exception raised for validation errors"""
    def __init__(self, detail: str = "Validation error"):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail
        )

class ConflictException(ServiceBusinessException):
    """Exception raised for conflict errors"""
    def __init__(self, detail: str = "Resource conflict"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail
        )

class BadRequestException(ServiceBusinessException):
    """Exception raised for bad request errors"""
    def __init__(self, detail: str = "Bad request"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )