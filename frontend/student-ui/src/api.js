import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3002',
  timeout: 30000,
});

export const identityApi = axios.create({
  baseURL: import.meta.env.VITE_AUTH_URL || 'http://localhost:3001',
  timeout: 30000,
});

const setupInterceptors = (instance) => {
  instance.interceptors.request.use((cfg) => {
    const isAdminPath = window.location.pathname.startsWith('/admin');
    const token = isAdminPath
      ? (sessionStorage.getItem('admin_jwt') || sessionStorage.getItem('jwt'))
      : sessionStorage.getItem('jwt');

    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        const isAdminPath = window.location.pathname.startsWith('/admin');
        if (isAdminPath) {
          sessionStorage.removeItem('admin_jwt');
          if (window.location.pathname !== '/admin/login') {
            window.location.href = '/admin/login';
          }
        } else {
          sessionStorage.removeItem('jwt');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      }
      return Promise.reject(error);
    }
  );
};

setupInterceptors(api);
setupInterceptors(identityApi);

export default api;
