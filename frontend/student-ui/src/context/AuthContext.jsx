import { createContext, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => sessionStorage.getItem('jwt') || null);
  const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem('user')) || null);
  const navigate = useNavigate();

  const login = (jwt, userInfo) => {
    sessionStorage.setItem('jwt', jwt);
    sessionStorage.setItem('user', JSON.stringify(userInfo));
    setToken(jwt);
    setUser(userInfo);
    navigate('/dashboard');
  };

  const logout = () => {
    sessionStorage.removeItem('jwt');
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
