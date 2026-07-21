import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, formatDate } from '../lib/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: Notification[] }>('/notifications/'),
  });

  const notifications = data?.data || [];

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {notifications.some((n) => !n.read) && (
          <button onClick={markAllRead} className="btn-secondary text-sm">Mark all read</button>
        )}
      </div>
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <p className="text-slate-500">No notifications.</p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`card cursor-pointer transition ${!n.read ? 'border-l-4 border-l-bank-600' : ''}`}
              onClick={() => !n.read && markRead(n.id)}
            >
              <div className="flex justify-between">
                <h3 className={`font-medium ${!n.read ? 'text-bank-900' : 'text-slate-600'}`}>{n.title}</h3>
                <span className="text-xs text-slate-400">{formatDate(n.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">{n.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
