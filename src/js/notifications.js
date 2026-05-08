/* DashDriver Notifications Logic */

function openNotifications() {
  // Mock or basic notification panel for now
  showToast('Nenhuma notificação nova');
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (badge) badge.classList.add('hidden');
}

function checkGoalPush() {
  // logic to check if goal reached
}
