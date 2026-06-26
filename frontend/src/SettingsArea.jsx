import React, { useState } from 'react';
import { apiRequest } from './api';
import './SettingsArea.css';

export default function SettingsArea({ workspace, currentUser, onBackToWorkspaces, members, activeTab, setActiveTab, onUserUpdate }) {
    // Profile Fields
    const [name, setName] = useState(currentUser.name || '');
    const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');

    // Password Fields
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const [loadingProfile, setLoadingProfile] = useState(false);
    const [loadingPassword, setLoadingPassword] = useState(false);
    const [profileSuccess, setProfileSuccess] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [error, setError] = useState('');

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoadingProfile(true);
        setError('');
        setProfileSuccess('');

        try {
            const data = await apiRequest('/users/profile', {
                method: 'PUT',
                body: JSON.stringify({ name, avatarUrl })
            });
            // Update local storage user details
            const updatedUser = { ...currentUser, name: data.user.name, avatarUrl: data.user.avatarUrl };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            // Notify global state in App.jsx
            if (onUserUpdate) {
                onUserUpdate(updatedUser);
            }

            setProfileSuccess('Profile details updated successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (!oldPassword || !newPassword) return;
        setLoadingPassword(true);
        setError('');
        setPasswordSuccess('');

        try {
            await apiRequest('/users/password', {
                method: 'PUT',
                body: JSON.stringify({ oldPassword, newPassword })
            });
            setPasswordSuccess('Password changed successfully!');
            setOldPassword('');
            setNewPassword('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingPassword(false);
        }
    };

    const handleLeaveWorkspace = async () => {
        if (!window.confirm(`Are you sure you want to leave the workspace "${workspace.name}"? You will lose access until re-invited.`)) return;
        setError('');

        try {
            await apiRequest(`/workspaces/${workspace.id}/leave`, {
                method: 'POST'
            });
            alert(`You have successfully left "${workspace.name}"`);
            onBackToWorkspaces(); // Redirect to workspace selector
        } catch (err) {
            setError(err.message);
        }
    };

    const getUserInitials = (name) => {
        if (!name) return 'U';
        return name.substring(0, 2).toUpperCase();
    };

    // Find active user's role in workspace
    const memberRecord = members.find(m => m.user.id === currentUser.id);
    const userRole = memberRecord ? memberRecord.role : 'MEMBER';

    return (
        <div className="chat-screen-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <header className="sidebar-header">
                    <h3>{workspace.name}</h3>
                    <button className="btn-back" onClick={onBackToWorkspaces} title="Back to workspaces">
                        ←
                    </button>
                </header>

                <div className="sidebar-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chat')}
                    >
                        💬 Chat
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'snippets' ? 'active' : ''}`}
                        onClick={() => setActiveTab('snippets')}
                    >
                        💻 Snippets
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'github' ? 'active' : ''}`}
                        onClick={() => setActiveTab('github')}
                    >
                        🐙 GitHub
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        ⚙️ Settings
                    </button>
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">
                        <span>Workspace Settings</span>
                    </div>
                    <div className="settings-sidebar-info">
                        <h4>{workspace.name}</h4>
                        <p className="ws-desc-muted">{workspace.description || 'No description provided.'}</p>
                        <div className="role-pill-container">
                            <span className="role-label-text">Your Role:</span>
                            <span className={`role-badge role-${userRole.toLowerCase()}`}>{userRole}</span>
                        </div>
                    </div>
                </div>

                <footer className="sidebar-footer">
                    <div className="sidebar-user-info">
                        <span className="user-avatar">
                            {getUserInitials(currentUser.name)}
                        </span>
                        <span className="sidebar-username">{currentUser.name}</span>
                    </div>
                </footer>
            </aside>

            {/* Main Panel */}
            <main className="settings-main">
                <div className="settings-container">
                    <header className="settings-header">
                        <h2>Account & Workspace Settings</h2>
                        <p>Manage your account credentials, display profile details, and workspace status.</p>
                    </header>

                    {error && <div className="error-banner">{error}</div>}

                    <div className="settings-grid">
                        {/* Profile Settings */}
                        <div className="settings-card">
                            <h3>Profile Details</h3>
                            <form onSubmit={handleUpdateProfile} className="settings-form">
                                <div className="avatar-preview-section">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt="Avatar Preview" className="preview-circle-img" onError={(e) => { e.target.style.display = 'none'; }} />
                                    ) : (
                                        <div className="preview-avatar-initials">{getUserInitials(name)}</div>
                                    )}
                                    <div className="avatar-info-text">
                                        <span className="avatar-title">Avatar Image</span>
                                        <span className="avatar-helper">Provide a URL link to your display picture.</span>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Full Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Avatar URL</label>
                                    <input
                                        type="url"
                                        className="form-input"
                                        placeholder="https://example.com/avatar.jpg"
                                        value={avatarUrl}
                                        onChange={(e) => setAvatarUrl(e.target.value)}
                                    />
                                </div>

                                {profileSuccess && <div className="success-banner">{profileSuccess}</div>}

                                <button type="submit" className="btn-primary" disabled={loadingProfile}>
                                    {loadingProfile ? "Saving..." : "Save Profile Details"}
                                </button>
                            </form>
                        </div>

                        {/* Security Settings */}
                        <div className="settings-card">
                            <h3>Security & Credentials</h3>
                            <form onSubmit={handleChangePassword} className="settings-form">
                                <div className="form-group">
                                    <label className="form-label">Current Password</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        placeholder="••••••••"
                                        value={oldPassword}
                                        onChange={(e) => setOldPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">New Password</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        placeholder="Minimum 6 characters"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                    />
                                </div>

                                {passwordSuccess && <div className="success-banner">{passwordSuccess}</div>}

                                <button type="submit" className="btn-primary" disabled={loadingPassword}>
                                    {loadingPassword ? "Updating..." : "Update Password"}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Workspace Actions (Danger Zone) */}
                    <div className="settings-danger-zone">
                        <h3>Workspace Actions</h3>
                        <div className="danger-zone-card">
                            <div className="danger-text-info">
                                <h4>Leave Workspace</h4>
                                <p>Remove yourself as a member of <strong>{workspace.name}</strong>. You will lose immediate access and will need to be re-invited to join back.</p>
                            </div>
                            <div className="danger-action-button">
                                {userRole === 'OWNER' ? (
                                    <span className="owner-action-warning">
                                        ⚠️ Workspace Owner cannot leave. Transfer ownership or delete workspace from the selector dashboard.
                                    </span>
                                ) : (
                                    <button className="btn-danger" onClick={handleLeaveWorkspace}>
                                        Leave Workspace
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
