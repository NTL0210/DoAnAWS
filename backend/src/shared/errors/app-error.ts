export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "DEPENDENCY_NOT_READY";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(params: {
    code: ErrorCode;
    message: string;
    statusCode: number;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "AppError";
    this.code = params.code;
    this.statusCode = params.statusCode;
    this.details = params.details;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super({ code: "NOT_FOUND", message, statusCode: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super({ code: "CONFLICT", message, statusCode: 409 });
  }
}
