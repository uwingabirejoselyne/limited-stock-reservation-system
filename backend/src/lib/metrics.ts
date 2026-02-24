// Simple in-memory metrics counters.
// For production you'd swap this out for Prometheus/OpenTelemetry.
export const metrics = {
  requestCount: 0,
  errorCount: 0,
  reservationsCreated: 0,
  reservationsExpired: 0,
  checkoutsCompleted: 0,
};
