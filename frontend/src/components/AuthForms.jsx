import React, { useState } from 'react';
import { useAuth } from './AuthProvider';

const AuthForms = () => {
  const [showLogin, setShowLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, register, isAuthenticated, user, logout } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('請輸入使用者名稱和密碼');
      return;
    }

    console.log(`正在嘗試${showLogin ? '登入' : '註冊'} 用戶名: ${username}`);
    
    let result;
    try {
      if (showLogin) {
        result = await login(username, password);
      } else {
        result = await register(username, password);
      }

      console.log(`${showLogin ? '登入' : '註冊'} 結果:`, result);

      if (!result.success) {
        setError(result.error);
      } else {
        // 成功登入或註冊後清除表單
        setUsername('');
        setPassword('');
      }
    } catch (err) {
      console.error(`${showLogin ? '登入' : '註冊'} 過程中出現錯誤:`, err);
      setError(`操作失敗: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    const result = await logout();
    if (!result.success) {
      setError(result.error);
    }
  };

  if (isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-status">
          <p>已登入為 <strong>{user.username}</strong></p>
          <button onClick={handleLogout} className="logout-btn">登出</button>
        </div>
        {error && <div className="auth-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-tabs">
        <button 
          className={`auth-tab ${showLogin ? 'active' : ''}`} 
          onClick={() => setShowLogin(true)}
        >
          登入
        </button>
        <button 
          className={`auth-tab ${!showLogin ? 'active' : ''}`} 
          onClick={() => setShowLogin(false)}
        >
          註冊
        </button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="username" className="auth-label">使用者名稱：</label>
          <input
            id="username"
            type="text"
            placeholder="輸入使用者名稱"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="auth-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="password" className="auth-label">密碼：</label>
          <input
            id="password"
            type="password"
            placeholder="輸入密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
          />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="auth-submit">
          {showLogin ? '登入' : '註冊'}
        </button>
      </form>
      <div className="auth-toggle">
        <p>
          {showLogin ? '還沒有帳號？' : '已有帳號？'}
          <button 
            className="auth-toggle-btn" 
            onClick={() => setShowLogin(!showLogin)}
          >
            {showLogin ? '立即註冊' : '前往登入'}
          </button>
        </p>
        <div className="guest-notice">
          <span>未登入時將以訪客模式進入遊戲</span>
        </div>
      </div>
    </div>
  );
};

export default AuthForms;
