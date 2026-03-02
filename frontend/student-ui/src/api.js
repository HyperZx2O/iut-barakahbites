import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3002',
  timeout: 8000,
});

export const identityApi = axios.create({
  baseURL: import.meta.env.VITE_AUTH_URL || 'http://localhost:3001',
  timeout: 8000,
});

const setupInterceptors = (instance) => {
  instance.interceptors.request.use((cfg) => {
    const token = sessionStorage.getItem('jwt');
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        sessionStorage.removeItem('jwt');
        // Avoid infinite redirect if already on login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
};

setupInterceptors(api);
setupInterceptors(identityApi);

export default api;
