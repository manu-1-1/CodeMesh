import { useState, useEffect } from 'react';
import Auth from './Auth';
import WorkspaceSelector from './WorkspaceSelector';
import ChatArea from './ChatArea';

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
        user={user}
        onSelectWorkspace={(ws) => setCurrentWorkspace(ws)}
        onLogout={handleLogout}
        onUserUpdate={(updatedUser) => setUser(updatedUser)}
      />
    );
  }

  // Screen 3: Active Workspace selected -> Show Chat & Channels Screen
  return (
    <ChatArea
      workspace={currentWorkspace}
      currentUser={user}
      onBackToWorkspaces={() => setCurrentWorkspace(null)}
      onUserUpdate={(updatedUser) => setUser(updatedUser)}
      onWorkspaceUpdate={(updatedWs) => setCurrentWorkspace(updatedWs)}
    />
  );
}
