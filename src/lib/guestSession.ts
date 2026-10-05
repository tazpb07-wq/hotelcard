// Generates (once) and returns a persistent session ID stored on the
// guest's device. Used to link anonymous reservations to this device
// without requiring login or relying on IP addresses.
const KEY = "df_guest_session";

export function getGuestSessionId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

export function getDeviceInfo() {
  return {
    device_session: getGuestSessionId(),
    user_agent: navigator.userAgent,
    language: navigator.language,
    platform: (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform,
    screen: `${window.screen.width}x${window.screen.height}`,
  };
}
