/**
 * Single app-wide heartbeat for push/process-reminders (avoids duplicate intervals).
 */
import { processDeployReminders } from '../utils/webPush';

let intervalId = null;
let subscriberCount = 0;
let activeApiClient = null;

export function startDeployReminderHeartbeat(apiClient) {
  if (!apiClient) return;
  activeApiClient = apiClient;
  subscriberCount += 1;
  if (intervalId) return;

  processDeployReminders(apiClient);
  intervalId = setInterval(() => {
    if (activeApiClient) processDeployReminders(activeApiClient);
  }, 60000);
}

export function stopDeployReminderHeartbeat() {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount > 0) return;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  activeApiClient = null;
}
