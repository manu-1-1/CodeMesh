import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import './WorkspaceSelector.css';

export default function WorkspaceSelector({ onSelectWorkspace, onLogout }) {
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    useEffect(() => {
        fetchWorkspaces();
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