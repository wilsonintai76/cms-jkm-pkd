import { SLT_FIELDS } from "../constants";

export function fmt(v: number | string | undefined | null): string {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  return String(n);
}

export function topicTotalSlt(topic: Record<string, unknown>): number {
  const sum = SLT_FIELDS.reduce((acc, f) => acc + (Number(topic[f.key]) || 0), 0);
  return Math.round(sum * 100) / 100;
}
