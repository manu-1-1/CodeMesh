import React, { useState, useEffect } from 'react';
import { apiRequest } from './api';
import './SnippetsArea.css';

export default function SnippetsArea({ workspace, currentUser, onBackToWorkspaces, members, activeTab, setActiveTab }) {
    const [snippets, setSnippets] = useState([]);
    const [selectedSnippet, setSelectedSnippet] = useState(null);
    const [snippetDetails, setSnippetDetails] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [loadingReview, setLoadingReview] = useState(false);
    const [error, setError] = useState('');

    // Form fields for new snippet
    const [newTitle, setNewTitle] = useState('');
    const [newLanguage, setNewLanguage] = useState('javascript');
    const [newCode, setNewCode] = useState('');

    useEffect(() => {
        fetchSnippets();
    }, [workspace.id]);

    const fetchSnippets = async () => {
        try {
            const data = await apiRequest(`/snippets?workspaceId=${workspace.id}`);
            setSnippets(data);
            if (data.length > 0) {
                fetchSnippetDetails(data[0].id);
            } else {
                setSelectedSnippet(null);
                setSnippetDetails(null);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const fetchSnippetDetails = async (snippetId) => {
        try {
            const data = await apiRequest(`/snippets/${snippetId}`);
            setSelectedSnippet(data);
            setSnippetDetails(data);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleCreateSnippet = async (e) => {
        e.preventDefault();
        if (!newTitle.trim() || !newCode.trim()) return;

        try {
            const snippet = await apiRequest('/snippets', {
                method: 'POST',
                body: JSON.stringify({
                    workspaceId: workspace.id,
                    title: newTitle.trim(),
                    language: newLanguage,
                    code: newCode
                })
            });

            setSnippets((prev) => [snippet, ...prev]);
            setSelectedSnippet(snippet);
            setSnippetDetails(snippet);
            setShowModal(false);
            setNewTitle('');
            setNewCode('');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDeleteSnippet = async (snippetId) => {
        if (!window.confirm("Are you sure you want to delete this snippet?")) return;

        try {
            await apiRequest(`/snippets/${snippetId}`, { method: 'DELETE' });
            fetchSnippets();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleRunAIReview = async () => {
        if (!selectedSnippet) return;
        setLoadingReview(true);

        try {
            const review = await apiRequest('/reviews', {
                method: 'POST',
                body: JSON.stringify({ snippetId: selectedSnippet.id })
            });

            // Update snippet details locally with the new review
            setSnippetDetails((prev) => ({
                ...prev,
                reviews: [review, ...(prev.reviews || [])]
            }));
        } catch (err) {
            alert(err.message);
        } finally {
            setLoadingReview(false);
        }
    };

    // Helper to parse review text into separate categorized card items
    const parseReviewFindings = (summary) => {
        if (!summary) return [];
        const lines = summary.split('\n');
        return lines.map((line, idx) => {
            if (line.includes('[SECURITY]')) {
                return { id: idx, type: 'security', label: 'Security Alert', text: line.replace('- [SECURITY]', '').trim() };
            }
            if (line.includes('[STYLE]')) {
                return { id: idx, type: 'style', label: 'Style Feedback', text: line.replace('- [STYLE]', '').trim() };
            }
            if (line.includes('[QUALITY]')) {
                return { id: idx, type: 'quality', label: 'Quality Insight', text: line.replace('- [QUALITY]', '').trim() };
            }
            return null;
        }).filter(Boolean);
    };

    const getUserInitials = (name) => {
        if (!name) return 'U';
        return name.substring(0, 2).toUpperCase();
    };

    // Filter snippets list
    const filteredSnippets = snippets.filter((s) => {
        const query = searchQuery.toLowerCase();
        return (
            s.title.toLowerCase().includes(query) ||
            s.language.toLowerCase().includes(query) ||
            (s.author?.name || '').toLowerCase().includes(query)
        );
    });

    // Check permissions to delete
    const canDelete = (snippet) => {
        if (!snippet) return false;
        if (snippet.authorId === currentUser.id) return true;
        const currentMember = members.find((m) => m.user.id === currentUser.id);
        return currentMember && (currentMember.role === 'OWNER' || currentMember.role === 'ADMIN');
    };

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
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">
                        <span>Code Snippets</span>
                        <button className="btn-add" onClick={() => setShowModal(true)} title="Share snippet">
                            +
                        </button>
                    </div>

                    <div className="search-box-wrapper">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search snippets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <ul className="sidebar-list">
                        {filteredSnippets.map((s) => (
                            <li
                                key={s.id}
                                className={`sidebar-item ${selectedSnippet?.id === s.id ? 'active' : ''}`}
                                onClick={() => fetchSnippetDetails(s.id)}
                            >
                                <span className="snippet-icon">📄</span>
                                <div className="snippet-item-text">
                                    <span className="snippet-title">{s.title}</span>
                                    <span className="snippet-meta">{s.language} • {s.author?.name}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
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

            {/* Main Panel split into Code Viewer and AI Code Reviews */}
            <main className="snippets-main">
                {snippetDetails ? (
                    <div className="snippets-grid">
                        {/* Left Side: Code Editor Viewer */}
                        <div className="code-viewer-panel">
                            <header className="panel-header">
                                <div className="header-info">
                                    <h2>{snippetDetails.title}</h2>
                                    <div className="badge-row">
                                        <span className="language-badge">{snippetDetails.language}</span>
                                        <span className="author-name">By {snippetDetails.author?.name}</span>
                                    </div>
                                </div>
                                {canDelete(snippetDetails) && (
                                    <button
                                        className="btn-danger"
                                        onClick={() => handleDeleteSnippet(snippetDetails.id)}
                                    >
                                        Delete
                                    </button>
                                )}
                            </header>

                            <div className="editor-container">
                                <div className="line-numbers">
                                    {snippetDetails.code.split('\n').map((_, index) => (
                                        <div key={index} className="line-num">{index + 1}</div>
                                    ))}
                                </div>
                                <pre className="code-block">
                                    <code>{snippetDetails.code}</code>
                                </pre>
                            </div>
                        </div>

                        {/* Right Side: AI Code Review Panel */}
                        <div className="review-panel">
                            <header className="panel-header">
                                <h3>AI Code Review</h3>
                                <button
                                    className="btn-primary run-review-btn"
                                    onClick={handleRunAIReview}
                                    disabled={loadingReview}
                                >
                                    {loadingReview ? "Analyzing..." : "Run AI Review"}
                                </button>
                            </header>

                            <div className="review-content">
                                {loadingReview && (
                                    <div className="loading-card">
                                        <div className="spinner"></div>
                                        <span>CodeMesh AI is analyzing your code details...</span>
                                    </div>
                                )}

                                {!loadingReview && (!snippetDetails.reviews || snippetDetails.reviews.length === 0) ? (
                                    <div className="review-empty">
                                        <div className="empty-icon">🤖</div>
                                        <h4>No Review Conducted</h4>
                                        <p>Run the AI Code Review to inspect this snippet for security exploits, bugs, and optimization suggestions.</p>
                                    </div>
                                ) : (
                                    !loadingReview && snippetDetails.reviews.map((rev) => {
                                        const findings = parseReviewFindings(rev.summary);
                                        return (
                                            <div key={rev.id} className="review-session-card">
                                                <div className="review-meta">
                                                    <span className="reviewer-name">{rev.reviewerType}</span>
                                                    <span className="review-date">
                                                        {new Date(rev.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="findings-list">
                                                    {findings.map((f) => (
                                                        <div key={f.id} className={`finding-card finding-${f.type}`}>
                                                            <div className="finding-header">
                                                                <span className="finding-badge">{f.label}</span>
                                                            </div>
                                                            <p className="finding-text">{f.text}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="snippets-empty-state">
                        <div className="icon">💻</div>
                        <h2>No Snippets in Workspace</h2>
                        <p>Share code snippets, configurations, or utility scripts to collaborate and perform AI code reviews.</p>
                        <button className="btn-primary" onClick={() => setShowModal(true)} style={{ width: 'auto', padding: '12px 24px', marginTop: '16px' }}>
                            Share First Snippet
                        </button>
                    </div>
                )}
            </main>

            {/* Share Snippet Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content snippet-modal">
                        <h3 className="modal-title">Share Code Snippet</h3>
                        <form onSubmit={handleCreateSnippet}>
                            <div className="form-group">
                                <label className="form-label">Snippet Title</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Binary Search implementation"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Programming Language</label>
                                <select
                                    className="form-input"
                                    value={newLanguage}
                                    onChange={(e) => setNewLanguage(e.target.value)}
                                >
                                    <option value="javascript">JavaScript</option>
                                    <option value="typescript">TypeScript</option>
                                    <option value="python">Python</option>
                                    <option value="go">Go</option>
                                    <option value="java">Java</option>
                                    <option value="rust">Rust</option>
                                    <option value="cpp">C++</option>
                                    <option value="c">C</option>
                                    <option value="html">HTML</option>
                                    <option value="css">CSS</option>
                                    <option value="sql">SQL</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Source Code</label>
                                <textarea
                                    className="form-input code-textarea"
                                    placeholder="Paste your source code here..."
                                    value={newCode}
                                    onChange={(e) => setNewCode(e.target.value)}
                                    required
                                ></textarea>
                            </div>
                            <div className="modal-buttons">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                                    Share
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
