import React, { useState, useEffect } from 'react';
import { apiRequest } from './api';
import './WorkspaceSelector.css';

export default function WorkspaceSelector({ onSelectWorkspace, onLogout }) {
    const [workspaces, setWorkspaces] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        fetchWorkspaces();
        fetchInvitations();
    }, []);

    const fetchWorkspaces = async () => {
        try {
            setLoading(true);
            const data = await apiRequest('/workspaces');
            setWorkspaces(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchInvitations = async () => {
        try {
            const data = await apiRequest('/invitations/pending');
            setInvitations(data);
        } catch (err) {
            console.error('Failed to fetch pending invitations:', err);
        }
    };

    const handleAcceptInvitation = async (invitationId) => {
        try {
            setError('');
            await apiRequest(`/invitations/${invitationId}/accept`, {
                method: 'POST'
            });
            alert('Invitation accepted successfully!');
            fetchWorkspaces();
            fetchInvitations();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeclineInvitation = async (invitationId) => {
        if (!window.confirm('Are you sure you want to decline this invitation?')) return;
        try {
            setError('');
            await apiRequest(`/invitations/${invitationId}/decline`, {
                method: 'POST'
            });
            fetchInvitations();
        } catch (err) {
            setError(err.message);
        }
    };
    const handleCreateWorkspace = async (e) => {
        e.preventDefault();
        if (!newWorkspaceName.trim()) return;
        setIsCreating(true);
        setError('');
        try {
            const data = await apiRequest('/workspaces', {
                method: 'POST',
                body: JSON.stringify({
                    name: newWorkspaceName.trim(),
                    description: newWorkspaceDesc.trim(),
                }),
            });
            setWorkspaces((prev) => [...prev, data.workspace]);
            setNewWorkspaceName('');
            setNewWorkspaceDesc('');
        } catch (err) {
            setError(err.message);
        } finally {
            setIsCreating(false);
        }
    };
    if (loading) {
        return (
            <div className="workspace-loading">
                Loading workspaces...
            </div>
        );
    }
    return (
        <div className="workspace-selector-container">
            <header className="workspace-header">
                <div>
                    <h1 className="workspace-title">Your Workspaces</h1>
                    <p className="workspace-subtitle">Select a workspace or create a new one to start collaborating.</p>
                </div>
                <button className="btn-logout" onClick={onLogout}>
                    Logout
                </button>
            </header>
            {error && <div className="alert alert-error">{error}</div>}

            {/* Pending Invitations Section */}
            {invitations.length > 0 && (
                <div className="invitations-section">
                    <h3 className="invitations-section-title">Pending Invitations</h3>
                    <div className="invitations-list">
                        {invitations.map((invite) => (
                            <div key={invite.id} className="invitation-card">
                                <div className="invitation-info">
                                    <h4 className="invitation-workspace-name">{invite.workspace?.name}</h4>
                                    <p className="invitation-details">
                                        Invited by: <strong>{invite.invitedBy?.name || 'Someone'}</strong> as a <span className="invitation-role-badge">{invite.role}</span>
                                    </p>
                                </div>
                                <div className="invitation-actions">
                                    <button 
                                        className="btn-primary btn-accept" 
                                        onClick={() => handleAcceptInvitation(invite.id)}
                                    >
                                        Accept
                                    </button>
                                    <button 
                                        className="btn-decline" 
                                        onClick={() => handleDeclineInvitation(invite.id)}
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="workspace-grid">
                {workspaces.map((workspace) => (
                    <div
                        key={workspace.id}
                        className="workspace-card"
                        onClick={() => onSelectWorkspace(workspace)}
                    >
                        <div className="workspace-card-content">
                            <h4>{workspace.name}</h4>
                            <p>{workspace.description || 'No description provided.'}</p>
                        </div>
                        <div className="workspace-card-meta">
                            {workspace.members?.length || 1} Member(s)
                        </div>
                    </div>
                ))}
                <form className="create-workspace-card" onSubmit={handleCreateWorkspace}>
                    <h4 className="create-workspace-title">Create Workspace</h4>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Workspace Name (e.g. My Team)"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        required
                    />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Description (optional)"
                        value={newWorkspaceDesc}
                        onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                    />
                    <button type="submit" className="btn-primary" disabled={isCreating}>
                        {isCreating ? 'Creating...' : 'Create'}
                    </button>
                </form>
            </div>
        </div>
    );
}