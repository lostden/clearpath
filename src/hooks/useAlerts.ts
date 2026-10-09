import { useAlertsContext } from "@/state/AlertsProvider";

/** Tabs share the provider's one request stream, provenance, and expiration clock. */
export function useAlerts() {
  return useAlertsContext();
}
