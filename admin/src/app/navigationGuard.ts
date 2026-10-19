export function canLeaveWorkspace(historyTraversal = false): boolean {
  return window.dispatchEvent(
    new CustomEvent("durafit:before-navigation", {
      cancelable: true,
      detail: { historyTraversal },
    }),
  );
}
