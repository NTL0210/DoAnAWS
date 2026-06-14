export interface TraceContext {
  requestId: string;
}

export function getTraceContext(requestId: string): TraceContext {
  return { requestId };
}
