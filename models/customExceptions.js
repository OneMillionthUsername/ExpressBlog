export class AdminControllerException extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "AdminControllerException";
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}