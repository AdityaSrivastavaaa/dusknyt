import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, MessageCircle, Phone, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { ArrivalRoom, Button, useAuth } from '@dusknyt/ui';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const OPEN_INBOX_EVENT = 'dusknyt:open-arrival-inbox';

export function CallNotificationButton() {
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const openInbox = async () => {
    if ('Notification' in window && Notification.permission === 'default') setPermission(await Notification.requestPermission());
    window.dispatchEvent(new Event(OPEN_INBOX_EVENT));
  };
  const label = permission === 'granted' ? 'Call notifications enabled' : permission === 'denied' ? 'Allow call notifications in browser settings' : permission === 'unsupported' ? 'Browser notifications unavailable' : 'Enable call notifications';
  return <button type="button" aria-label={`${label}. Open recent call and chat alerts`} title={`${label} · View alerts`} onClick={openInbox} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-card/70 text-brand">
    {permission === 'denied' || permission === 'unsupported' ? <BellOff size={18} /> : <Bell size={18} />}
    {permission === 'granted' && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-ok ring-2 ring-bg" />}
  </button>;
}

export function ArrivalCallListener() {
  const { token } = useAuth();
  const socketRef = useRef(null);
  const [alert, setAlert] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [inboxOpen, setInboxOpen] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    const socket = io(`${apiUrl.replace(/\/$/, '')}/arrival`, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    const show = (kind) => (item) => {
      const alertItem = { ...item, kind };
      setInbox((current) => [alertItem, ...current.filter((entry) => !(entry.requestId === item.requestId && entry.kind === kind))].slice(0, 12));
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
          notification.onclick = () => { window.focus(); setAlert(null); setInboxOpen(false); setActiveRoom({ ...alertItem, autoAnswer: kind === 'call' }); notification.close(); };
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
  }, [token]);

  useEffect(() => {
    const open = () => setInboxOpen(true);
    window.addEventListener(OPEN_INBOX_EVENT, open);
    return () => window.removeEventListener(OPEN_INBOX_EVENT, open);
  }, []);

  const dismiss = () => {
    if (alert?.kind === 'call') socketRef.current?.emit('call:decline', { requestId: alert.requestId });
    setAlert(null);
  };

  return <>
    {alert && !inboxOpen && <div role="alert" className="fixed inset-x-3 bottom-[5.5rem] z-[80] mx-auto max-w-lg rounded-2xl border border-brand/50 bg-card/95 p-4 shadow-2xl backdrop-blur-xl sm:bottom-6">
      <button type="button" aria-label="Dismiss alert" onClick={dismiss} className="absolute right-3 top-3 rounded-full p-1 text-muted hover:bg-line"><X size={16} /></button>
      <div className="flex items-start gap-3 pr-6"><span className="mt-0.5 rounded-xl bg-brand/15 p-2 text-brand">{alert.kind === 'call' ? <Phone size={18} /> : <MessageCircle size={18} />}</span><div className="min-w-0 flex-1"><p className="font-bold">{alert.kind === 'call' ? 'Incoming guest call' : 'New guest message'}</p><p className="mt-1 break-words text-sm text-muted">{alert.guestName} · {alert.eventTitle || alert.clubName}{alert.guestCount ? ` · ${alert.guestCount} guest${alert.guestCount === 1 ? '' : 's'}` : ''}</p><div className="mt-3 flex gap-2"><Button className="!w-auto !py-2 text-xs" onClick={() => { setActiveRoom({ ...alert, autoAnswer: alert.kind === 'call' }); setAlert(null); }}>{alert.kind === 'call' ? 'Answer call' : 'Open chat'}</Button>{alert.kind === 'call' && <Button variant="outline" className="!w-auto !py-2 text-xs" onClick={dismiss}>Decline</Button>}</div></div></div>
    </div>}
    {inboxOpen && <div className="fixed inset-0 z-[85] bg-black/45" onClick={() => setInboxOpen(false)}><section role="dialog" aria-label="Call and chat alerts" className="fixed right-3 top-[calc(env(safe-area-inset-top)+.75rem)] flex max-h-[75dvh] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex items-center justify-between border-b border-line p-4"><div><h2 className="font-bold">Call & chat alerts</h2><p className="text-xs text-muted">Tap an alert to open its guest room</p></div><button type="button" onClick={() => setInboxOpen(false)} aria-label="Close alerts" className="rounded-full p-2 text-muted"><X size={18} /></button></header><div className="min-h-0 space-y-2 overflow-y-auto p-3">{inbox.length ? inbox.map((item, index) => <button type="button" key={`${item.requestId}-${item.kind}-${index}`} onClick={() => { setInboxOpen(false); setAlert(null); setActiveRoom({ ...item, autoAnswer: item.kind === 'call' }); }} className="flex w-full items-start gap-3 rounded-xl border border-line p-3 text-left"><span className="mt-0.5 rounded-lg bg-brand/15 p-2 text-brand">{item.kind === 'call' ? <Phone size={16} /> : <MessageCircle size={16} />}</span><span className="min-w-0 flex-1"><span className="block font-semibold">{item.kind === 'call' ? 'Incoming call' : 'New message'}</span><span className="mt-0.5 block break-words text-xs text-muted">{item.guestName} · {item.eventTitle || item.clubName}</span></span></button>) : <p className="px-3 py-8 text-center text-sm text-muted">No call or chat alerts yet.</p>}</div></section></div>}
    {activeRoom && <ArrivalRoom token={token} requestId={activeRoom.requestId} title={`${activeRoom.eventTitle || 'Guestlist'} · ${activeRoom.clubName}`} autoAnswer={activeRoom.autoAnswer} onClose={() => setActiveRoom(null)} />}
  </>;
}
