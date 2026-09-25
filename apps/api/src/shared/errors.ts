import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ApiError, ErrorDetails } from '@taskio/contracts';

export class ApiException extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
    public readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'ApiException';
  }
}

function sendError(
  reply: FastifyReply,
  request: FastifyRequest,
  statusCode: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
  details?: ErrorDetails,
): void {
  const body: ApiError = { error: { code, message, requestId: request.id } };
  if (fields) body.error.fields = fields;
  if (details) body.error.details = details;
  void reply.code(statusCode).send(body);
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    sendError(reply, request, 404, 'NOT_FOUND', 'Resource not found');
  });

  app.setErrorHandler((error: FastifyError | ApiException, request, reply) => {
    if (error instanceof ApiException) {
      sendError(reply, request, error.statusCode, error.code, error.message, error.fields, error.details);
      return;
    }
    if (error.code === 'FST_ERR_VALIDATION') {
      const fields = Object.fromEntries((error.validation ?? []).map(issue => [issue.instancePath || issue.params.missingProperty as string || 'request', issue.message ?? 'is invalid']));
      sendError(reply, request, 400, 'VALIDATION_ERROR', 'Request validation failed', fields);
      return;
    }
    if (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') {
      sendError(reply, request, 400, 'INVALID_JSON', 'Request body must contain valid JSON');
      return;
    }
    if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
      sendError(reply, request, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
      return;
    }
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      sendError(reply, request, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
      return;
    }
    request.log.error({ requestId: request.id, errorType: error.name }, 'Request failed');
    sendError(reply, request, 500, 'INTERNAL_ERROR', 'Internal server error');
  });
}
