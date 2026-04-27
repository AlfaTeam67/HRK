"""Core application exceptions."""


class AppError(Exception):
    """Base class for application errors."""


class DocumentError(AppError):
    """Base exception for document operations."""


class DocumentValidationError(DocumentError):
    """Raised on invalid document input."""


class DocumentNotFoundError(DocumentError):
    """Raised when the document was not found."""


class DocumentStorageError(DocumentError):
    """Raised when underlying storage operation fails."""


class DocumentAccessDeniedError(DocumentError):
    """Raised when user has no permission to access a document."""
