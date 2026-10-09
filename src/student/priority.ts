/**
 * MILESTONE 5: This contract is AI-assisted scaffolding, not a finished algorithm.
 * Implement your own deterministic ordering and explain each decision.
 * Do not claim physical safety, change official severity/instructions, or drop warnings.
 * See STUDENT_CONTRIBUTIONS.md for acceptance cases and authorship tracking.
 * The running app currently retains the NWS point endpoint's provider order.
 */
import type { Coordinates, OfficialAlert } from "@/domain/types";
export type PriorityContext = { point: Coordinates; now: number };
export type OrderedWarning = { alert: OfficialAlert; explanation: string };
export type StudentPrioritizer = (
  alerts: readonly OfficialAlert[],
  context: PriorityContext,
) => readonly OrderedWarning[];

// Your implementation goes here. It is deliberately not connected to the app yet.
