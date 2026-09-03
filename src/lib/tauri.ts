/**
 * Detect if the app is running inside a Tauri webview.
 *
 * In Tauri v2 the `window.__TAURI_INTERNALS__` object is injected
 * automatically into the webview context.
 */
export function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}
