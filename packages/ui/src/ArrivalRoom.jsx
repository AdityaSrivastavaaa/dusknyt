import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { MessageCircle, Phone, PhoneOff, Send, X } from 'lucide-react';
import { Button, cx } from './components.jsx';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TURN_URL = import.meta.env.VITE_TURN_URL;

export function ArrivalRoom({ token, requestId, title, onClose }) {
  const socketRef = useRef(null); const peerRef = useRef(null); const streamRef = useRef(null); const pendingOfferRef = useRef(null); const pendingIceRef = useRef([]); const messagesEndRef = useRef(null); const audioRef = useRef(null); const closeTimerRef = useRef(null);
  const [connected, setConnected] = useState(false); const [status, setStatus] = useState('Connecting securely…'); const [messages, setMessages] = useState([]); const [draft, setDraft] = useState(''); const [error, setError] = useState(''); const [closesAt, setClosesAt] = useState(null); const [incoming, setIncoming] = useState(false); const [callState, setCallState] = useState('idle'); const [myId, setMyId] = useState('');

  useEffect(() => {
    const socket = io(`${apiUrl.replace(/\/$/, '')}/arrival`, { auth: { token }, autoConnect: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    const addMessage = (message) => setMessages((old) => old.some((item) => item.id === message.id) ? old : [...old, message]);
    socket.on('connect', () => socket.emit('arrival:join', { requestId }, (result) => {
      if (!result?.ok) { setStatus(result?.error || 'Arrival session unavailable.'); socket.disconnect(); return; }
      setConnected(true); setStatus('Connected to this booking'); setMessages(result.messages || []); setClosesAt(result.closesAt); setMyId(result.userId || '');
      const delay = new Date(result.closesAt).getTime() - Date.now();
      if (delay > 0) closeTimerRef.current = setTimeout(() => { setStatus('The one-hour arrival session has ended.'); socket.emit('arrival:session-closed'); socket.disconnect(); setConnected(false); endCall(false); }, delay);
    }));
    socket.on('connect_error', (e) => setStatus(e.message || 'Could not connect to arrival chat.'));
    socket.on('arrival:message', addMessage);
    socket.on('arrival:peer', () => setStatus('The other person is connected'));
    socket.on('arrival:peer-left', () => setStatus('The other person disconnected'));
    socket.on('call:offer', (offer) => { pendingOfferRef.current = offer; setIncoming(true); setCallState('incoming'); });
    socket.on('call:answer', async ({ description } = {}) => { if (description && peerRef.current) { await peerRef.current.setRemoteDescription(description); await applyPendingIce(peerRef.current); setCallState('connected'); } });
    socket.on('call:ice', async (candidate) => { try { if (candidate && peerRef.current) { if (peerRef.current.remoteDescription) await peerRef.current.addIceCandidate(candidate); else pendingIceRef.current.push(candidate); } } catch {} });
    socket.on('call:hangup', () => endCall(false));
    socket.on('arrival:session-closed', () => { setStatus('The one-hour arrival session has ended.'); setConnected(false); endCall(false); socket.disconnect(); });
    return () => { clearTimeout(closeTimerRef.current); socket.emit('arrival:session-closed'); socket.disconnect(); peerRef.current?.close(); streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, [requestId, token]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function endCall(signal = true) {
    if (signal) socketRef.current?.emit('call:hangup');
    peerRef.current?.close(); peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
    pendingOfferRef.current = null; setIncoming(false); setCallState('idle');
  }

  async function localAudio() {
    if (!streamRef.current) streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return streamRef.current;
  }

  async function peerFor(stream) {
    if (peerRef.current) return peerRef.current;
    const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (TURN_URL) iceServers.push({ urls: TURN_URL, username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL });
    const peer = new RTCPeerConnection({ iceServers }); peerRef.current = peer;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.onicecandidate = ({ candidate }) => { if (candidate) socketRef.current?.emit('call:ice', candidate.toJSON()); };
    peer.ontrack = ({ streams }) => { if (audioRef.current) { audioRef.current.srcObject = streams[0]; audioRef.current.play().catch(() => {}); } };
    peer.onconnectionstatechange = () => { if (peer.connectionState === 'connected') setCallState('connected'); else if (['failed', 'disconnected'].includes(peer.connectionState)) setCallState('idle'); };
    return peer;
  }

  async function applyPendingIce(peer) {
    const candidates = pendingIceRef.current.splice(0);
    for (const candidate of candidates) { try { await peer.addIceCandidate(candidate); } catch {} }
  }

  async function startCall() {
    try {
      setError(''); setCallState('calling');
      const peer = await peerFor(await localAudio());
      const description = await peer.createOffer(); await peer.setLocalDescription(description);
      socketRef.current.emit('call:offer', { description });
    } catch (e) { setError(e.message || 'Could not start the call. Check microphone access.'); endCall(false); }
  }

  async function acceptCall() {
    try {
      setError('');
      const peer = await peerFor(await localAudio());
      await peer.setRemoteDescription(pendingOfferRef.current.description); await applyPendingIce(peer);
      const description = await peer.createAnswer(); await peer.setLocalDescription(description);
      socketRef.current.emit('call:answer', { description }); setIncoming(false); setCallState('connected');
    } catch (e) { setError(e.message || 'Could not answer the call. Check microphone access.'); endCall(false); }
  }

  const send = (event) => {
    event.preventDefault(); const body = draft.trim();
    if (!body || !connected) return;
    socketRef.current.emit('arrival:message', { body }, (result) => {
      if (result?.ok) { addMessageLocal(result.message); setDraft(''); }
      else setError(result?.error || 'Message could not be sent.');
    });
  };
  const addMessageLocal = (message) => setMessages((old) => old.some((item) => item.id === message.id) ? old : [...old, message]);

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-2 sm:items-center sm:p-4"><section className="glass-panel flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line shadow-2xl">
    <header className="flex items-center justify-between border-b border-line p-4"><div className="min-w-0"><h2 className="flex items-center gap-2 font-bold"><MessageCircle size={17} className="text-brand" />Arrival chat</h2><p className="truncate text-xs text-muted">{title || 'Guestlist booking'} · {status}</p>{closesAt && <p className="text-[10px] text-muted">Closes {new Date(closesAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })} India time</p>}</div><button type="button" aria-label="Close arrival chat" onClick={onClose} className="rounded-full border border-line p-2"><X size={18} /></button></header>
    <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">{incoming ? <><Button className="!w-auto gap-2 !px-3 !py-2 text-xs" onClick={acceptCall}><Phone size={14} />Answer call</Button><Button variant="outline" className="!w-auto !px-3 !py-2 text-xs" onClick={() => { setIncoming(false); endCall(false); }}>Decline</Button></> : callState === 'idle' ? <Button className="!w-auto gap-2 !px-3 !py-2 text-xs" disabled={!connected} onClick={startCall}><Phone size={14} />Call</Button> : <Button variant="outline" className="!w-auto gap-2 !px-3 !py-2 text-xs" onClick={() => endCall()}><PhoneOff size={14} />{callState === 'connected' ? 'End call' : 'Cancel call'}</Button>}{callState === 'connected' && <span className="text-xs text-ok">Call connected</span>}</div>
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">{messages.length ? messages.map((message) => <div key={message.id} className={cx('max-w-[88%] rounded-xl p-3 text-sm', message.senderId === myId ? 'ml-auto bg-brand/20' : 'mr-auto bg-card')}><p className="mb-1 text-[10px] font-semibold text-muted">{message.senderName}</p><p className="whitespace-pre-wrap break-words">{message.body}</p></div>) : <p className="py-8 text-center text-sm text-muted">Use chat to agree on where to meet at the venue.</p>}<div ref={messagesEndRef} /></div>
    {error && <p className="mx-3 mb-2 rounded-xl bg-bad/10 p-2 text-xs text-bad">{error}</p>}
    <form onSubmit={send} className="flex gap-2 border-t border-line p-3"><input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} disabled={!connected} placeholder={connected ? 'Write a message…' : 'Chat opens one hour before the event'} className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand" /><Button aria-label="Send message" className="!w-auto !px-3" disabled={!connected || !draft.trim()}><Send size={16} /></Button></form>
    <audio ref={audioRef} autoPlay className="hidden" />
  </section></div>;
}
