import React, { createContext, useState, useEffect, useContext } from 'react';

// Create the authentication context
export const AuthContext = createContext(null);

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Define the API base URL
const API_BASE_URL = 'http://127.0.0.1:8000';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check for current user on initial load
  useEffect(() => {
    const checkCurrentUser = async () => {
      try {
        console.log('Checking current user status...');
        const response = await fetch(`${API_BASE_URL}/api/auth/current_user/`, {
          credentials: 'include'  // This is important for cookie-based auth
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Current user data:', data);
          if (data.is_authenticated) {
            setUser(data.user);
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('Error checking authentication status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkCurrentUser();
  }, []);

  // Login function
  const login = async (username, password) => {
    setLoading(true);
    try {
      console.log('Attempting to login with:', { username, password: '****' });
      
      const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      console.log('Login response status:', response.status);
      const data = await response.json();
      console.log('Login response data:', data);
      
      if (response.ok) {
        setUser(data.user);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { success: false, error: data.error || '登入失敗，請稍後再試' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: '登入時發生錯誤，請確認網絡連接' };
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (username, password) => {
    setLoading(true);
    try {
      console.log('Attempting to register with:', { username, password: '****' });
      
      const response = await fetch(`${API_BASE_URL}/api/auth/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      console.log('Registration response status:', response.status);
      const data = await response.json();
      console.log('Registration response data:', data);
      
      if (response.ok) {
        setUser(data.user);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { 
          success: false, 
          error: Array.isArray(data.error) ? data.error.join(', ') : data.error || '註冊失敗，請稍後再試' 
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: '註冊時發生錯誤，請確認網絡連接' };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout/`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setUser(null);
        setIsAuthenticated(false);
        return { success: true };
      } else {
        const data = await response.json();
        return { success: false, error: data.error || '登出失敗' };
      }
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: '登出時發生錯誤，請確認網絡連接' };
    } finally {
      setLoading(false);
    }
  };

  // Auth context value
  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
