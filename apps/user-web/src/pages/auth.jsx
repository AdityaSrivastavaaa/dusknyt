import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button, Input, Logo, useAuth, Header } from '@dusknyt/ui';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';

export function Login() {
  const nav = useNavigate(); const { state } = useLocation(); const { login } = useAuth();
  const [phone, setPhone] = useState(''); const [err, setErr] = useState('');
  const send = useMutation({
    mutationFn: () => http.post('/auth/user/send-otp', { phone }),
    onSuccess: (d) => nav('/verify', { state: { phone, from: state?.from, devOtp: d.devOtp } }),
    onError: (e) => setErr(errMsg(e)),
  });
  const gid = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const google = () => {
    if (!gid) return setErr('Google login is not configured (set VITE_GOOGLE_CLIENT_ID).');
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => { window.google.accounts.id.initialize({ client_id: gid, callback: async (r) => {
      try { const d = await http.post('/auth/user/google', { idToken: r.credential }); login(d.token, d.user); nav(d.isNew ? '/setup' : state?.from || '/', { replace: true, state: { from: state?.from } }); } catch (e) { setErr(errMsg(e)); } } });
      window.google.accounts.id.prompt(); };
    document.body.appendChild(s);
  };
  return (
    <div className="flex min-h-screen flex-col justify-center p-6">
      <h1 className="text-center text-sm text-muted">Welcome to</h1><Logo className="mb-1 block text-center text-3xl" /><p className="mb-8 text-center text-xs text-muted">Sign in to continue</p>
      <div className="space-y-4">
        <Input label="Mobile number" inputMode="numeric" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} error={err} />
        <Button loading={send.isPending} disabled={phone.replace(/\D/g, '').length < 10} onClick={() => { setErr(''); send.mutate(); }}>Continue</Button>
        <p className="text-center text-xs text-muted">or</p>
        <Button variant="outline" onClick={google}>Continue with Google</Button>
      </div>
      <p className="mt-8 text-center text-[11px] text-muted">By continuing, you agree to our Terms & Conditions and Privacy Policy</p>
    </div>
  );
}

export function Verify() {
  const nav = useNavigate(); const { state } = useLocation(); const { login } = useAuth();
  const [digits, setDigits] = useState(Array(6).fill('')); const [err, setErr] = useState(''); const [left, setLeft] = useState(25);
  const refs = useRef([]);
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  const verify = useMutation({
    mutationFn: () => http.post('/auth/user/verify-otp', { phone: state.phone, otp: digits.join('') }),
    onSuccess: (d) => { login(d.token, d.user); nav(d.isNew ? '/setup' : state.from || '/', { replace: true, state: { from: state.from } }); },
    onError: (e) => setErr(errMsg(e)),
  });
  if (!state?.phone) return <Navigate to="/login" replace />;
  const set = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const n = [...digits]; n[i] = v; setDigits(n);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };
  return (
    <div className="p-6">
      <Header back title="Verify your number" />
      <p className="mt-6 text-center text-sm text-muted">We have sent a 6-digit code to<br /><b className="text-fg">{state.phone}</b></p>
      {state.devOtp && <p className="mt-2 text-center text-xs text-warn">Dev OTP: {state.devOtp}</p>}
      <div className="my-6 flex justify-center gap-2">{digits.map((d, i) => (
        <input key={i} ref={(el) => (refs.current[i] = el)} value={d} inputMode="numeric" maxLength={1} onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && refs.current[i - 1]?.focus()}
          className="h-12 w-11 rounded-xl border border-line bg-card text-center text-lg outline-none focus:border-brand" />))}</div>
      {err && <p className="mb-3 text-center text-xs text-bad">{err}</p>}
      <Button loading={verify.isPending} disabled={digits.join('').length < 6} onClick={() => { setErr(''); verify.mutate(); }}>Verify</Button>
      <p className="mt-4 text-center text-xs text-muted">{left > 0 ? `Resend OTP in 00:${String(left).padStart(2, '0')}` : <button className="text-brand" onClick={() => { http.post('/auth/user/send-otp', { phone: state.phone }); setLeft(25); }}>Resend OTP</button>}</p>
      <button className="mx-auto mt-3 block text-xs text-brand" onClick={() => nav('/login', { replace: true })}>Change Number</button>
    </div>
  );
}

export function ProfileSetup() {
  const nav = useNavigate(); const { state } = useLocation(); const { user, update } = useAuth();
  const [f, setF] = useState({ name: user?.name || '', email: user?.email || '', dob: '' }); const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => http.put('/me', f),
    onSuccess: (u) => { update(u); nav(state?.from || '/', { replace: true }); },
    onError: (e) => setErr(errMsg(e)),
  });
  return (
    <div className="p-6">
      <h1 className="mt-8 text-center text-xl font-bold">Almost There!</h1><p className="mb-6 text-center text-xs text-muted">Tell us a bit about yourself</p>
      <div className="space-y-4">
        <Input label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Email (optional)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input label="Date of birth" type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} />
        {err && <p className="text-xs text-bad">{err}</p>}
        <Button loading={save.isPending} disabled={f.name.trim().length < 2} onClick={() => save.mutate()}>Continue</Button>
      </div>
    </div>
  );
}
