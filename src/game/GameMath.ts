export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
export function damp(a: number, b: number, lambda: number, dt: number) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}
export function normalizeAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
export function angleDiff(a: number, b: number) {
  return normalizeAngle(b - a);
}
export function rotateToward(cur: number, target: number, maxStep: number) {
  const d = angleDiff(cur, target);
  if (Math.abs(d) <= maxStep) return target;
  return normalizeAngle(cur + Math.sign(d) * maxStep);
}
export function forward(a: number) {
  const { sin, cos } = Math;
  return { x: sin(a), y: cos(a) };
}
