import { createHttp } from '@dusknyt/api-client';
export const http = createHttp(import.meta.env.VITE_API_URL || 'http://localhost:4000', { loginPath: '/login' });
