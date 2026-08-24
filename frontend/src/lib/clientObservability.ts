import { track } from "@vercel/analytics/react";

const STATIC_ROUTES = new Set(["/", "/about", "/history", "/play", "/admin"]);

export function routeCategory(pathname: string): string {
  if (STATIC_ROUTES.has(pathname)) return pathname;
  if (/^\/play\/[^/]+$/.test(pathname)) return "/play/:gameId";
  if (/^\/history\/[^/]+$/.test(pathname)) return "/history/:gameId";
  return "other";
}

function safeErrorName(value: unknown): string {
  if (value instanceof Error) return value.name.slice(0, 60) || "Error";
  return "UnknownError";
}

export function reportClientError(kind: "render" | "error" | "rejection", value: unknown) {
  if (!import.meta.env.PROD) return;
  try {
    track("client_error", {
      kind,
      error_name: safeErrorName(value),
      route: routeCategory(window.location.pathname),
      environment: import.meta.env.MODE,
    });
  } catch (reportingError) {
    console.warn("Unable to report client error", reportingError);
  }
}

export function installGlobalErrorReporting() {
  window.addEventListener("error", (event) => reportClientError("error", event.error));
  window.addEventListener("unhandledrejection", (event) => reportClientError("rejection", event.reason));
}
