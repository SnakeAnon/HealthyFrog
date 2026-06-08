/**
 * Bridges axios 401 handling to React Router without ``window.location``,
 * which unmounts the whole app and often shows a blank white frame.
 */

let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export function triggerUnauthorized(): void {
  if (onUnauthorized) {
    onUnauthorized();
    return;
  }
  localStorage.removeItem("token");
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.assign("/login");
  }
}
