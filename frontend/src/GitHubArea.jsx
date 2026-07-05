import { useState, useEffect } from 'react';
import { apiRequest } from './api';
import './GitHubArea.css';
export default function GitHubArea({ workspace, currentUser, onBackToWorkspaces, members, activeTab, setActiveTab }) {
    const [isConnected, setIsConnected] = useState(false);
    const [githubUsername, setGithubUsername] = useState('');
    const [repos, setRepos] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState('');
    const [usernameInput, setUsernameInput] = useState('');
    const [tokenInput, setTokenInput] = useState('');
    const checkStatus = async () => {
        try {
            const data = await apiRequest('/github/status');
            setIsConnected(data.connected);
            if (data.connected && data.connection) {
                setGithubUsername(data.connection.githubUsername);
            }
        } catch (err) {
            console.error('Failed to fetch github status:', err);
        } finally {
            setLoading(false);
        }
    };
    const fetchRepos = async () => {
        try {
            const data = await apiRequest(`/github/repositories?workspaceId=${workspace.id}`);
            setRepos(data);
            if (data.length > 0) {
                setSelectedRepo(data[0]);
            }
        } catch (err) {
            setError(err.message);
        }
    };
    useEffect(() => {
        checkStatus();
        fetchRepos();
    }, [workspace.id]);

    const handleConnect = async (e) => {
        e.preventDefault();
        if (!usernameInput.trim() || !tokenInput.trim()) return;
        setLoading(true);
        setError('');

        try {
            await apiRequest('/github/connect', {
                method: 'POST',
                body: JSON.stringify({
                    githubUsername: usernameInput.trim(),
                    accessToken: tokenInput.trim()
                })
            });
            setIsConnected(true);
            setGithubUsername(usernameInput.trim());
            setUsernameInput('');
            setTokenInput('');
            // Trigger automatic sync for the workspace upon connection
            handleSync();
        } catch (err) {
            setError(err.message);
            setIsConnected(false);
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm("Are you sure you want to disconnect your GitHub account? This will remove connection credentials.")) return;
        setLoading(true);
        setError('');

        try {
            await apiRequest('/github/disconnect', { method: 'DELETE' });
            setIsConnected(false);
            setGithubUsername('');
            setRepos([]);
            setSelectedRepo(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setError('');
        try {
            const data = await apiRequest('/github/sync', {
                method: 'POST',
                body: JSON.stringify({ workspaceId: workspace.id })
            });
            setRepos(data.repositories);
            if (data.repositories.length > 0) {
                setSelectedRepo(data.repositories[0]);
            }
            alert('Workspace synchronized successfully with GitHub!');
        } catch (err) {
            setError(err.message);
        } finally {
            setSyncing(false);
        }
    };

    const getUserInitials = (name) => {
        if (!name) return 'U';
        return name.substring(0, 2).toUpperCase();
    };

    if (loading) {
        return (
            <div className="chat-screen-layout">
                <div className="github-loading-state">
                    <div className="spinner"></div>
                    <p>Loading GitHub details...</p>
                </div>
            </div>
        );
    }

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
                        <span>GitHub Repos</span>
                        {isConnected && (
                            <button
                                className="btn-sync-refresh"
                                onClick={handleSync}
                                title="Sync Repositories"
                                disabled={syncing}
                            >
                                {syncing ? '⌛' : '🔄'}
                            </button>
                        )}
                    </div>

                    {isConnected && repos.length > 0 ? (
                        <ul className="sidebar-list">
                            {repos.map((repo) => (
                                <li
                                    key={repo.id}
                                    className={`sidebar-item ${selectedRepo?.id === repo.id ? 'active' : ''}`}
                                    onClick={() => setSelectedRepo(repo)}
                                >
                                    <span className="snippet-icon">📦</span>
                                    <div className="snippet-item-text">
                                        <span className="snippet-title">{repo.name}</span>
                                        <span className="snippet-meta">PRs: {repo.pullRequests?.length || 0}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="sidebar-empty-info">
                            {isConnected ? "No repos synced yet." : "Connect account to view repos."}
                        </div>
                    )}
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
            <main className="github-main">
                {!isConnected ? (
                    <div className="github-connect-container">
                        <div className="github-connect-card">
                            <div className="github-logo-badge">🐙</div>
                            <h2>Connect GitHub Account</h2>
                            <p className="github-description">
                                Link your GitHub account to sync repositories, pull requests, and enable real-time pull request reviews in this workspace.
                            </p>

                            {error && <div className="error-banner">{error}</div>}

                            <form onSubmit={handleConnect} className="github-form">
                                <div className="form-group">
                                    <label className="form-label">GitHub Username</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. octocat"
                                        value={usernameInput}
                                        onChange={(e) => setUsernameInput(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Personal Access Token</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        placeholder="ghp_xxxxxxxxxxxx"
                                        value={tokenInput}
                                        onChange={(e) => setTokenInput(e.target.value)}
                                        required
                                    />
                                    <span className="form-helper">Tokens are encrypted and stored securely.</span>
                                </div>
                                <button type="submit" className="btn-primary" disabled={loading}>
                                    {loading ? "Connecting..." : "Connect GitHub Account"}
                                </button>
                            </form>
                        </div>
                    </div>
                ) : (
                    <div className="github-content-layout">
                        {selectedRepo ? (
                            <div className="repo-details-panel">
                                <header className="repo-details-header">
                                    <div className="repo-title-wrapper">
                                        <span className="repo-icon">📦</span>
                                        <div>
                                            <h2>{selectedRepo.name}</h2>
                                            <span className="repo-fullname">{selectedRepo.fullName}</span>
                                        </div>
                                    </div>
                                    <div className="header-actions">
                                        <a
                                            href={`https://github.com/${selectedRepo.fullName}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-github-link"
                                        >
                                            View on GitHub ↗
                                        </a>
                                    </div>
                                </header>

                                <div className="pr-list-section">
                                    <h3>Pull Requests ({selectedRepo.pullRequests?.length || 0})</h3>

                                    {selectedRepo.pullRequests && selectedRepo.pullRequests.length > 0 ? (
                                        <div className="pr-cards-grid">
                                            {selectedRepo.pullRequests.map((pr) => (
                                                <div key={pr.id} className="pr-card">
                                                    <div className="pr-card-header">
                                                        <span className="pr-number">#{pr.number}</span>
                                                        <span className={`pr-status-badge status-${pr.state.toLowerCase()}`}>
                                                            {pr.state}
                                                        </span>
                                                    </div>
                                                    <h4 className="pr-title">{pr.title}</h4>
                                                    <div className="pr-card-footer">
                                                        <a
                                                            href={pr.htmlUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn-pr-link"
                                                        >
                                                            Open PR ↗
                                                        </a>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="pr-empty-state">
                                            <p>No pull requests found for this repository.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="github-empty-details">
                                <div className="icon">🐙</div>
                                <h2>GitHub Linked Successfully</h2>
                                <p>Logged in as <strong>{githubUsername}</strong></p>

                                <div className="github-status-card">
                                    <div className="status-item">
                                        <span className="status-label">Status</span>
                                        <span className="status-val active-badge">Connected</span>
                                    </div>
                                    <div className="status-item">
                                        <span className="status-label">Username</span>
                                        <span className="status-val">{githubUsername}</span>
                                    </div>
                                </div>

                                <div className="button-group-row">
                                    <button className="btn-primary" onClick={handleSync} disabled={syncing} style={{ width: 'auto', padding: '10px 20px' }}>
                                        {syncing ? "Syncing..." : "Sync Repositories Now"}
                                    </button>
                                    <button className="btn-danger-outline" onClick={handleDisconnect}>
                                        Disconnect Account
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
