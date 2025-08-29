export class AdminControllerException extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "AdminControllerException";
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class CardControllerException extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "CardControllerException";
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class CommentControllerException extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "CommentControllerException";
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class PostControllerException extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "PostControllerException";
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class MediaControllerException extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "MediaControllerException";
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UtilsException extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "UtilsException";
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}