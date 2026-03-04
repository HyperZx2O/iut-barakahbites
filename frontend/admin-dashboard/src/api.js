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
            // Redirect to the admin login page, which lives at /admin/login
            // (the BrowserRouter basename="/admin" means the React route /login
            //  resolves to the absolute path /admin/login).
            window.location.href = '/admin/login';
        }
        return Promise.reject(error);
    }
);

export default api;
