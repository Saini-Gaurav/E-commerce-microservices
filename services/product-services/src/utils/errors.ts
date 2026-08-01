// A single error class shared by every service in this project, carrying
// its own HTTP status code. Controllers catch this and respond with
// err.statusCode; anything else that throws is treated as an unexpected
// 500. Same idea as auth-service's AuthError, factored out here since
// this service has more than one domain (categories + products) that
// both need it - two identically-behaved classes with different names
// would just be duplication for no benefit.
export class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ServiceError";
  }
}