import { createContext, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => sessionStorage.getItem('admin_jwt') || null);
    const navigate = useNavigate();

    const login = (jwt) => {
        sessionStorage.setItem('admin_jwt', jwt);
        setToken(jwt);
        navigate('/');
    };

    const logout = () => {
        sessionStorage.removeItem('admin_jwt');
        setToken(null);
        navigate('/login');
    };

    return (
        <AdminAuthContext.Provider value={{ token, login, logout }}>
            {children}
        </AdminAuthContext.Provider>
    );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
