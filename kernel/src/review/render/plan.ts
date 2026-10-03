import type { ReviewPlan } from "../domain/plan.ts";

export function renderPlan(plan: ReviewPlan): string {
  const short = (sha: string) => sha.slice(0, 12);
  const lines = [
    `${plan.change}: ${plan.anchor.kind} review of ${short(plan.anchor.sha)}..${short(plan.head)}, ` +
      `${String(plan.measure.files)} ${plan.measure.files === 1 ? "file" : "files"}, ` +
      `+${String(plan.measure.added)} -${String(plan.measure.removed)}`,
  ];
  if (plan.dirty.length > 0) {
    lines.push(`uncommitted, not reviewed: ${plan.dirty.join(", ")}`);
  }
  for (const group of plan.groups) {
    lines.push(
      `${group.id} (${group.kind}, ${String(group.files.length)}): ${group.files.join(", ")}`,
    );
  }
  if (plan.groups.length === 0) lines.push("nothing to review");
  return `${lines.join("\n")}\n`;
}
