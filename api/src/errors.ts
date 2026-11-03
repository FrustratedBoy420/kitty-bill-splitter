import type { ContentfulStatusCode } from 'hono/utils/http-status'

// Thrown by handlers and turned into `{ error }` JSON by app.onError.
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
  ) {
    super(message)
  }
}

export const badRequest = (message: string) => new ApiError(400, message)
export const notFound = (message: string) => new ApiError(404, message)
export const conflict = (message: string) => new ApiError(409, message)
export const unprocessable = (message: string) => new ApiError(422, message)
