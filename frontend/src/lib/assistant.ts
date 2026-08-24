export const OPEN_ASSISTANT_EVENT = "shodhfund:open-assistant";

export function openAssistant() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_ASSISTANT_EVENT));
  }
}
