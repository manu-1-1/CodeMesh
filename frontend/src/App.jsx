import React, { useState, useEffect } from 'react';
import Auth from './Auth';

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if the user is already logged in
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <Auth onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

  // Temporary Dashboard layout to verify everything works
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
        <h2>Welcome to CodeMesh, {user.username}!</h2>
        <button className="btn-primary" style={{ width: 'auto' }} onClick={handleLogout}>
          Logout
        </button>
      </header>
      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)' }}>
        <h3>Authentication Successful</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          You are now successfully authenticated with your Node.js backend.
        </p>
      </div>
    </div>
  );
}
