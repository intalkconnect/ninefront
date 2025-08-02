// utils/notifications.js
export function notifyUser({ title, body, icon }) {
  if (document.visibilityState === "visible") return; // só notifica fora de foco

  if ('Notification' in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon });
    }
  }
  // Toca som
  try {
    const audio = new Audio("/notificacao.mp3");
    audio.volume = 0.4;
    audio.play().catch(()=>{});
  } catch (err) { /* ignore */ }
}
