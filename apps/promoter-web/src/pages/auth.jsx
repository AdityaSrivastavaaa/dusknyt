import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button, Input, Logo, Tabs, useAuth } from '@dusknyt/ui';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';

export function Splash() {
  const nav = useNavigate(); const { token } = useAuth();
  useEffect(() => { const t = setTimeout(() => nav(token ? '/' : '/login', { replace: true }), 1200); return () => clearTimeout(t); }, []);
  return <div className="grid min-h-screen place-items-center bg-gradient-to-b from-bg to-brand-dark/30 text-center"><div><Logo className="text-4xl" /><p className="mt-2 text-xs tracking-[0.4em] text-brand">PROMOTER</p><p className="mt-6 text-sm text-muted">Manage offers.<br />Get more guests.</p></div></div>;
}

export function Login() {
  const nav = useNavigate(); const { state } = useLocation(); const { login, token } = useAuth();
  const [mode, setMode] = useState('password'); const [f, setF] = useState({ phone: '', password: '', otp: '' }); const [sent, setSent] = useState(false); const [err, setErr] = useState('');
  const done = (d) => { login(d.token, d.user); nav(state?.from || '/', { replace: true }); };
  const m = useMutation({
    mutationFn: async () => {
      if (mode === 'password') return done(await http.post('/auth/promoter/login', { phone: f.phone, password: f.password }));
      if (!sent) { const d = await http.post('/auth/promoter/send-otp', { phone: f.phone }); setSent(true); if (d.devOtp) setF((p) => ({ ...p, otp: d.devOtp })); return; }
      done(await http.post('/auth/promoter/verify-otp', { phone: f.phone, otp: f.otp }));
    },
    onError: (e) => setErr(errMsg(e)),
  });
  if (token) return <Navigate to={state?.from || '/'} replace />;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <Logo className="text-2xl" /><h1 className="mt-6 text-xl font-bold">Welcome Back!</h1><p className="mb-6 text-xs text-muted">Login to your promoter account</p>
      <Tabs tabs={[{ value: 'password', label: 'Password' }, { value: 'otp', label: 'OTP' }]} value={mode} onChange={(v) => { setMode(v); setSent(false); setErr(''); }} />
      <div className="mt-4 space-y-4">
        <Input label="Mobile number" inputMode="numeric" placeholder="+91 98765 43210" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        {mode === 'password' && <Input label="Password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}
        {mode === 'otp' && sent && <Input label="6-digit OTP" inputMode="numeric" maxLength={6} value={f.otp} onChange={(e) => setF({ ...f, otp: e.target.value })} />}
        {err && <p className="text-xs text-bad">{err}</p>}
        <Button loading={m.isPending} onClick={() => { setErr(''); m.mutate(); }}>{mode === 'otp' && !sent ? 'Send OTP' : 'Login'}</Button>
        <p className="text-center text-xs text-muted">New here? Contact DUSKNYT to get your promoter account approved.</p>
      </div>
    </div>
  );
}
