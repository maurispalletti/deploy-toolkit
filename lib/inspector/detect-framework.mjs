export function detectFramework(pkg) {
  if (!pkg) return "none";
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  if (deps.next) return "nextjs";
  if (deps.vite && deps.react) return "vite-react";
  if (deps["react-scripts"]) return "cra";
  if (deps.express || deps.fastify || deps.koa) return "express";
  return "unknown";
}
