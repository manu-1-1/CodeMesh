import React, { useState, useEffect } from 'react';
import Auth from './Auth';
import WorkspaceSelector from './WorkspaceSelector';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);

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
    setCurrentWorkspace(null);
  };

  // Screen 1: User not logged in -> Show Authentication
  if (!user) {
    return <Auth onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

  // Screen 2: Logged in, but no workspace selected -> Show Workspace Selector
  if (!currentWorkspace) {
    return (
      <WorkspaceSelector
        onSelectWorkspace={(ws) => setCurrentWorkspace(ws)}
        onLogout={handleLogout}
      />
    );
  }

  // Screen 3: Temporary Workspace selection preview (will be replaced by ChatArea)
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', alignItems: 'center' }}>
        <h2>Selected Workspace: {currentWorkspace.name}</h2>
        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '10px 20px' }}
          onClick={() => setCurrentWorkspace(null)}
        >
          Back to Workspaces
        </button>
      </header>
      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)' }}>
        <h3>Workspace ID: {currentWorkspace.id}</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Workspace successfully loaded! Next, we will build the **Chat & Channel Screen** (`ChatArea.jsx` and `ChatArea.css`) to replace this container.
        </p>
      </div>
    </div>
  );
}
