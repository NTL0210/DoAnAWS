export interface CounterMetric {
  name: string;
  value: number;
  tags?: Record<string, string>;
}

export function recordCounter(_metric: CounterMetric): void {
  // TODO: DOMAIN_DECISION_REQUIRED wire CloudWatch EMF, OpenTelemetry, or another backend.
}
