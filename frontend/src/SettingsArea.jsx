import { useState } from 'react';
import { apiRequest } from './api';
import './SettingsArea.css';

export default function SettingsArea({ workspace, currentUser, onBackToWorkspaces, members, activeTab, setActiveTab, onUserUpdate, onMembersUpdate, onWorkspaceUpdate }) {
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

    // Invite Member Fields
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('MEMBER');
    const [loadingInvite, setLoadingInvite] = useState(false);
    const [inviteSuccess, setInviteSuccess] = useState('');
    const [inviteError, setInviteError] = useState('');

    // Workspace Management Fields (for Workspace Owner)
    const [workspaceName, setWorkspaceName] = useState(workspace.name || '');
    const [workspaceDesc, setWorkspaceDesc] = useState(workspace.description || '');
    const [loadingWorkspace, setLoadingWorkspace] = useState(false);
    const [workspaceSuccess, setWorkspaceSuccess] = useState('');

    const handleUpdateWorkspace = async (e) => {
        e.preventDefault();
        if (!workspaceName.trim()) return;
        setLoadingWorkspace(true);
        setError('');
        setWorkspaceSuccess('');

        try {
            const data = await apiRequest(`/workspaces/${workspace.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: workspaceName.trim(),
                    description: workspaceDesc.trim()
                })
            });
            setWorkspaceSuccess('Workspace details updated successfully!');
            if (onWorkspaceUpdate) {
                onWorkspaceUpdate(data.workspace);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingWorkspace(false);
        }
    };

    const handleDeleteWorkspace = async () => {
        const confirmDelete = window.confirm(`WARNING: Are you sure you want to delete the workspace "${workspace.name}"? This action is permanent and all channels, messages, and settings will be permanently lost.`);
        if (!confirmDelete) return;

        const confirmDouble = window.prompt(`Please type the workspace name "${workspace.name}" to confirm deletion:`);
        if (confirmDouble !== workspace.name) {
            alert("Workspace name verification failed. Workspace was not deleted.");
            return;
        }

        setError('');
        try {
            await apiRequest(`/workspaces/${workspace.id}`, {
                method: 'DELETE'
            });
            alert(`Workspace "${workspace.name}" deleted successfully.`);
            onBackToWorkspaces();
        } catch (err) {
            setError(err.message);
        }
    };
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

    const handleInviteMember = async (e) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;
        setLoadingInvite(true);
        setInviteSuccess('');
        setInviteError('');

        try {
            await apiRequest(`/workspaces/${workspace.id}/members`, {
                method: 'POST',
                body: JSON.stringify({
                    email: inviteEmail.trim(),
                    role: inviteRole
                })
            });
            setInviteSuccess('Member invited successfully!');
            setInviteEmail('');
            setInviteRole('MEMBER');
            if (onMembersUpdate) {
                await onMembersUpdate();
            }
        } catch (err) {
            setInviteError(err.message);
        } finally {
            setLoadingInvite(false);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm("Are you sure you want to remove this member from the workspace?")) return;
        setError('');

        try {
            await apiRequest(`/workspaces/${workspace.id}/members/${userId}`, {
                method: 'DELETE'
            });
            if (onMembersUpdate) {
                await onMembersUpdate();
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleChangeRole = async (userId, newRole) => {
        setError('');
        try {
            await apiRequest(`/workspaces/${workspace.id}/members/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ role: newRole })
            });
            if (onMembersUpdate) {
                await onMembersUpdate();
            }
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

                        {/* Workspace Settings (Owner Only) */}
                        {userRole === 'OWNER' && (
                            <div className="settings-card">
                                <h3>Workspace Details</h3>
                                <p className="invite-desc-muted" style={{ fontSize: '12px', marginBottom: '12px' }}>
                                    Manage the public name and description of this workspace.
                                </p>
                                <form onSubmit={handleUpdateWorkspace} className="settings-form">
                                    <div className="form-group">
                                        <label className="form-label">Workspace Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={workspaceName}
                                            onChange={(e) => setWorkspaceName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Workspace Description</label>
                                        <textarea
                                            className="form-input"
                                            style={{ minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                                            value={workspaceDesc}
                                            onChange={(e) => setWorkspaceDesc(e.target.value)}
                                            placeholder="Add a description for this workspace"
                                        />
                                    </div>

                                    {workspaceSuccess && <div className="success-banner">{workspaceSuccess}</div>}

                                    <button type="submit" className="btn-primary" disabled={loadingWorkspace}>
                                        {loadingWorkspace ? "Saving..." : "Save Workspace Details"}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>

                    {/* Member Management Section (Visible to Owners and Admins) */}
                    {(userRole === 'OWNER' || userRole === 'ADMIN') && (
                        <div className="settings-members-section">
                            <h3>Workspace Member Management</h3>
                            <div className="members-management-grid">
                                {/* Left Side: Invite Form */}
                                <div className="settings-card invite-card">
                                    <h3>Invite New Member</h3>
                                    <p className="invite-desc-muted">Add team members to this workspace by their email address.</p>
                                    <form onSubmit={handleInviteMember} className="settings-form">
                                        <div className="form-group">
                                            <label className="form-label">Email Address</label>
                                            <input
                                                type="email"
                                                className="form-input"
                                                placeholder="colleague@example.com"
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Workspace Role</label>
                                            <select
                                                className="form-input"
                                                value={inviteRole}
                                                onChange={(e) => setInviteRole(e.target.value)}
                                            >
                                                <option value="MEMBER">Member</option>
                                                <option value="ADMIN">Admin</option>
                                            </select>
                                        </div>

                                        {inviteSuccess && <div className="success-banner">{inviteSuccess}</div>}
                                        {inviteError && <div className="error-banner">{inviteError}</div>}

                                        <button type="submit" className="btn-primary" disabled={loadingInvite} style={{ marginTop: '12px' }}>
                                            {loadingInvite ? "Sending Invite..." : "Invite Member"}
                                        </button>
                                    </form>
                                </div>

                                {/* Right Side: Members List */}
                                <div className="settings-card members-list-card">
                                    <h3>Workspace Members ({members.length})</h3>
                                    <div className="members-table-wrapper">
                                        <table className="members-table">
                                            <thead>
                                                <tr>
                                                    <th>Member</th>
                                                    <th>Role</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {members.map((memberObj) => {
                                                    const isSelf = memberObj.user.id === currentUser.id;
                                                    const isOwner = memberObj.role === 'OWNER';
                                                    const isTargetAdmin = memberObj.role === 'ADMIN';

                                                    // Determine if current user can remove this member
                                                    // - Owners can remove anyone except themselves
                                                    // - Admins can remove regular MEMBERS, but not other Admins or Owners
                                                    let canRemove = false;
                                                    if (!isSelf && !isOwner) {
                                                        if (userRole === 'OWNER') {
                                                            canRemove = true;
                                                        } else if (userRole === 'ADMIN' && !isTargetAdmin) {
                                                            canRemove = true;
                                                        }
                                                    }

                                                    // Only Workspace Owner can change roles
                                                    const canChangeRole = userRole === 'OWNER' && !isSelf && !isOwner;

                                                    return (
                                                        <tr key={memberObj.user.id}>
                                                            <td>
                                                                <div className="table-member-info">
                                                                    <span className="user-avatar member-avatar table-avatar">
                                                                        {getUserInitials(memberObj.user.name)}
                                                                    </span>
                                                                    <div className="member-details-col">
                                                                        <span className="member-name">{memberObj.user.name} {isSelf && "(You)"}</span>
                                                                        <span className="member-email">{memberObj.user.email}</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                {canChangeRole ? (
                                                                    <select
                                                                        className="table-role-select"
                                                                        value={memberObj.role}
                                                                        onChange={(e) => handleChangeRole(memberObj.user.id, e.target.value)}
                                                                    >
                                                                        <option value="MEMBER">Member</option>
                                                                        <option value="ADMIN">Admin</option>
                                                                    </select>
                                                                ) : (
                                                                    <span className={`role-badge role-${memberObj.role.toLowerCase()}`}>
                                                                        {memberObj.role}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {canRemove ? (
                                                                    <button
                                                                        className="btn-remove-member"
                                                                        onClick={() => handleRemoveMember(memberObj.user.id)}
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                ) : (
                                                                    <span className="action-disabled-text">-</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Workspace Actions (Danger Zone) */}
                    <div className="settings-danger-zone">
                        <h3>Workspace Actions</h3>
                        <div className="danger-zone-card">
                            {userRole === 'OWNER' ? (
                                <>
                                    <div className="danger-text-info">
                                        <h4>Delete Workspace</h4>
                                        <p>Permanently delete <strong>{workspace.name}</strong> and all its channels, messages, snippets, and integrations. This action is irreversible.</p>
                                    </div>
                                    <div className="danger-action-button">
                                        <button className="btn-danger" onClick={handleDeleteWorkspace}>
                                            Delete Workspace
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="danger-text-info">
                                        <h4>Leave Workspace</h4>
                                        <p>Remove yourself as a member of <strong>{workspace.name}</strong>. You will lose immediate access and will need to be re-invited to join back.</p>
                                    </div>
                                    <div className="danger-action-button">
                                        <button className="btn-danger" onClick={handleLeaveWorkspace}>
                                            Leave Workspace
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
