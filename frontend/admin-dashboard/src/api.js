import axios from 'axios';

const api = axios.create({
    timeout: 8000,
});

// For admin dashboard, we might want to add auth headers later
api.interceptors.request.use((cfg) => {
    const token = sessionStorage.getItem('admin_jwt');
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            sessionStorage.removeItem('admin_jwt');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
