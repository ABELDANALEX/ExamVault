import { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../api';

const AppContext = createContext(null);

function createNotice({ type = 'info', title, message }) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    type,
    title,
    message
  };
}

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [notices, setNotices] = useState([]);

  const dismissNotice = (id) => {
    setNotices((existing) => existing.filter((notice) => notice.id !== id));
  };

  const pushNotice = ({ type = 'info', title, message }) => {
    const notice = createNotice({ type, title, message });
    setNotices((existing) => [...existing, notice]);
    window.setTimeout(() => {
      dismissNotice(notice.id);
    }, 5000);
  };

  const refreshSession = async () => {
    const response = await apiRequest('/api/session');
    setCurrentUser(response.user);
    return response.user;
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await apiRequest('/api/session');
        if (active) {
          setCurrentUser(response.user);
        }
      } catch (error) {
        if (active) {
          setCurrentUser(null);
        }
      } finally {
        if (active) {
          setSessionLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const login = async (credentials) => {
    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: credentials
    });
    setCurrentUser(response.user);
    pushNotice({
      type: 'success',
      title: 'Signed In',
      message: response.message
    });
    return response.user;
  };

  const logout = async () => {
    const response = await apiRequest('/api/auth/logout', {
      method: 'POST'
    });
    setCurrentUser(null);
    pushNotice({
      type: 'success',
      title: 'Signed Out',
      message: response.message
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        sessionLoading,
        notices,
        dismissNotice,
        pushNotice,
        refreshSession,
        login,
        logout
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used within AppProvider.');
  }

  return context;
}
