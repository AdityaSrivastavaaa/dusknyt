import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button, Input, Logo, useAuth } from '@dusknyt/ui';
import { errMsg } from '@dusknyt/api-client';
import { http } from '../lib/api';

export function Login() {
  const nav = useNavigate(); const { login, token } = useAuth(); const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState('');
  const m = useMutation({ mutationFn: () => http.post('/auth/admin/login', f), onSuccess: (d) => { login(d.token, d.user); nav('/', { replace: true }); }, onError: (e) => setErr(errMsg(e)) });
  if (token) return <Navigate to="/" replace />;
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Logo className="text-2xl" /><p className="mb-8 text-[10px] tracking-[0.3em] text-brand">ADMIN PANEL</p>
      <h1 className="text-xl font-bold">Welcome Back!</h1><p className="mb-5 text-xs text-muted">Sign in to your admin account</p>
      <div className="space-y-4"><Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input label="Password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && m.mutate()} />
        {err && <p className="text-xs text-bad">{err}</p>}<Button loading={m.isPending} onClick={() => { setErr(''); m.mutate(); }}>Login</Button>
        <p className="text-center text-[11px] text-muted">Secure access to DUSKNYT admin</p></div>
    </div>
  );
}
