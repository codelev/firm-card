export class ServiceBusyError extends Error {
  constructor() {
    super("Server is busy");
    this.name = "ServiceBusyError";
  }
}

export class ServiceTimeoutError extends Error {
  constructor() {
    super("Processing took too long");
    this.name = "ServiceTimeoutError";
  }
}

export class InvalidImageError extends Error {
  constructor() {
    super("Image could not be read");
    this.name = "InvalidImageError";
  }
}
