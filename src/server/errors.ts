// An error whose message is safe and helpful to show to the user
// (e.g. "Only 3 pcs of LED Bulb left"). Anything else is logged and shown
// as a generic "Something went wrong".
export class AppError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
    readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
