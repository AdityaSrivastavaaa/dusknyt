import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, MessageCircle, Phone, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { Button, useAuth } from '@dusknyt/ui';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function CallNotificationButton() {
  const navigate = useNavigate();
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const openNotifications = async () => {
    if ('Notification' in window && Notification.permission === 'default') setPermission(await Notification.requestPermission());
    navigate('/notifications');
  };
  const label = permission === 'granted' ? 'Call alerts enabled · Open notifications' : permission === 'denied' ? 'Allow call alerts in browser settings · Open notifications' : permission === 'unsupported' ? 'Browser alerts unavailable · Open notifications' : 'Enable call alerts and open notifications';
  return <button type="button" aria-label={label} title={label} onClick={openNotifications} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-card/70 text-brand">
    {permission === 'denied' || permission === 'unsupported' ? <BellOff size={18} /> : <Bell size={18} />}
    {permission === 'granted' && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-ok ring-2 ring-bg" />}
  </button>;
}

export function ArrivalCallListener() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    const socket = io(`${apiUrl.replace(/\/$/, '')}/arrival`, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    const show = (kind) => (item) => {
      const alertItem = { ...item, kind };
      setAlert((current) => current?.kind === 'call' && kind === 'message' ? current : alertItem);
      const isHidden = document.visibilityState === 'hidden';
      if (isHidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const notification = new Notification(kind === 'call' ? 'Incoming guest call · DUSKNYT' : 'New guest message · DUSKNYT', {
            body: kind === 'call'
              ? `${item.guestName} is calling about ${item.eventTitle || item.clubName}.`
              : `${item.guestName} sent a message about ${item.eventTitle || item.clubName}.`,
            tag: `arrival-${item.requestId}`,
          });
          notification.onclick = () => { window.focus(); setAlert(null); navigate(`/arrival/${encodeURIComponent(item.requestId)}${kind === 'call' ? '?answer=1' : ''}`); notification.close(); };
        } catch { /* The in-app alert remains available when this browser blocks native notifications. */ }
      }
      if (kind === 'call' && item.expiresAt) {
        window.setTimeout(() => setAlert((current) => current?.kind === 'call' && current.requestId === item.requestId ? null : current), Math.max(0, item.expiresAt - Date.now()));
      }
    };
    socket.on('call:incoming', show('call'));
    socket.on('arrival:message-notification', show('message'));
    socket.on('connect_error', (error) => console.warn('Arrival call alerts unavailable:', error.message));
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [token, navigate]);

  const dismiss = () => {
    if (alert?.kind === 'call') socketRef.current?.emit('call:decline', { requestId: alert.requestId });
    setAlert(null);
  };

  return <>
    {alert && <div role="alert" className="fixed inset-x-3 bottom-[5.5rem] z-[80] mx-auto max-w-lg rounded-2xl border border-brand/50 bg-card/95 p-4 shadow-2xl backdrop-blur-xl sm:bottom-6">
      <button type="button" aria-label="Dismiss alert" onClick={dismiss} className="absolute right-3 top-3 rounded-full p-1 text-muted hover:bg-line"><X size={16} /></button>
      <div className="flex items-start gap-3 pr-6"><span className="mt-0.5 rounded-xl bg-brand/15 p-2 text-brand">{alert.kind === 'call' ? <Phone size={18} /> : <MessageCircle size={18} />}</span><div className="min-w-0 flex-1"><p className="font-bold">{alert.kind === 'call' ? 'Incoming guest call' : 'New guest message'}</p><p className="mt-1 break-words text-sm text-muted">{alert.guestName} · {alert.eventTitle || alert.clubName}{alert.guestCount ? ` · ${alert.guestCount} guest${alert.guestCount === 1 ? '' : 's'}` : ''}</p><div className="mt-3 flex gap-2"><Button className="!w-auto !py-2 text-xs" onClick={() => { const item = alert; setAlert(null); navigate(`/arrival/${encodeURIComponent(item.requestId)}${item.kind === 'call' ? '?answer=1' : ''}`); }}>{alert.kind === 'call' ? 'Answer call' : 'Open chat'}</Button>{alert.kind === 'call' && <Button variant="outline" className="!w-auto !py-2 text-xs" onClick={dismiss}>Decline</Button>}</div></div></div>
    </div>}
  </>;
}
