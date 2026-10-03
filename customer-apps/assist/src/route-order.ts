export function moveRouteTarget<T>(targets: readonly T[], from: number, to: number): T[] {
  const reordered = [...targets];
  if (!Number.isInteger(from) || !Number.isInteger(to)) return reordered;
  if (from < 0 || from >= reordered.length || to < 0 || to >= reordered.length || from === to) return reordered;
  const [target] = reordered.splice(from, 1);
  reordered.splice(to, 0, target);
  return reordered;
}
