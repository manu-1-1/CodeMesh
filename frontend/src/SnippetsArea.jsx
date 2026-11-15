import { useState, useEffect } from 'react';
import { apiRequest } from './api';
import { MessageSquare, Code, GitBranch, Settings, Edit2, Trash2 } from 'lucide-react';
import './SnippetsArea.css';

export default function SnippetsArea({ workspace, currentUser, onBackToWorkspaces, members, activeTab, setActiveTab, sidebarWidth, startResize }) {
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

    // Review panel tab: 'ai' | 'peer'
    const [reviewTab, setReviewTab] = useState('ai');

    // Peer review state
    const [peerReviews, setPeerReviews] = useState([]);
    const [loadingPeerReview, setLoadingPeerReview] = useState(false);
    const [selectedReviewerId, setSelectedReviewerId] = useState('');
    // Per-card comment drafts: { [reviewId]: string }
    const [reviewComments, setReviewComments] = useState({});

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

    const fetchPeerReviews = async (snippetId) => {
        if (!snippetId) return;
        setLoadingPeerReview(true);
        try {
            const data = await apiRequest(`/peer-reviews?snippetId=${snippetId}`);
            setPeerReviews(data);
        } catch (err) {
            alert(err.message);
        } finally {
            setLoadingPeerReview(false);
        }
    };

    useEffect(() => {
        fetchSnippets();
    }, [workspace.id]);

    // Fetch peer reviews whenever the selected snippet changes
    useEffect(() => {
        if (selectedSnippet) {
            fetchPeerReviews(selectedSnippet.id);
        } else {
            setPeerReviews([]);
        }
    }, [selectedSnippet?.id]);

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

    const handleRequestPeerReview = async () => {
        if (!selectedSnippet || !selectedReviewerId) return;
        try {
            await apiRequest('/peer-reviews', {
                method: 'POST',
                body: JSON.stringify({ snippetId: selectedSnippet.id, reviewerId: selectedReviewerId })
            });
            setSelectedReviewerId('');
            await fetchPeerReviews(selectedSnippet.id);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSubmitReview = async (reviewId, status) => {
        const comment = reviewComments[reviewId] || '';
        try {
            await apiRequest(`/peer-reviews/${reviewId}`, {
                method: 'PATCH',
                body: JSON.stringify({ status, comment })
            });
            setReviewComments((prev) => ({ ...prev, [reviewId]: '' }));
            await fetchPeerReviews(selectedSnippet.id);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleCancelPeerReview = async (reviewId) => {
        if (!window.confirm("Cancel this peer review request?")) return;
        try {
            await apiRequest(`/peer-reviews/${reviewId}`, { method: 'DELETE' });
            await fetchPeerReviews(selectedSnippet.id);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleReviewTabSwitch = (tab) => {
        setReviewTab(tab);
        if (tab === 'peer' && selectedSnippet) {
            fetchPeerReviews(selectedSnippet.id);
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

    // Avatar background colors — cycle based on first char code
    const getAvatarColor = (name) => {
        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#10b981', '#3b82f6'];
        if (!name) return colors[0];
        return colors[name.charCodeAt(0) % colors.length];
    };

    const getStatusBadgeClass = (status) => {
        if (status === 'APPROVED') return 'status-badge-approved';
        if (status === 'CHANGES_REQUESTED') return 'status-badge-changes';
        return 'status-badge-pending';
    };

    const getStatusLabel = (status) => {
        if (status === 'APPROVED') return '✅ Approved';
        if (status === 'CHANGES_REQUESTED') return '🔄 Changes Requested';
        return '⏳ Pending';
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

    const currentMember = members.find((m) => m.user.id === currentUser.id);
    const isOwnerOrAdmin = currentMember && (currentMember.role === 'OWNER' || currentMember.role === 'ADMIN');

    // Members selectable for peer review: exclude self
    const reviewableMembers = members.filter((m) => m.user.id !== currentUser.id);

    // Latest peer review for status badge
    const latestPeerReview = peerReviews.length > 0 ? peerReviews[0] : null;

    return (
        <div className="chat-screen-layout">
            {/* Sidebar */}
            <aside className="sidebar" style={{ width: `${sidebarWidth}px` }}>
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
                        <MessageSquare size={16} style={{marginRight: "6px", verticalAlign: "middle"}} /> Chat
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'snippets' ? 'active' : ''}`}
                        onClick={() => setActiveTab('snippets')}
                    >
                        <Code size={16} style={{marginRight: "6px", verticalAlign: "middle"}} /> Snippets
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'github' ? 'active' : ''}`}
                        onClick={() => setActiveTab('github')}
                    >
                        <GitBranch size={16} style={{marginRight: "6px", verticalAlign: "middle"}} /> GitHub
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        <Settings size={16} style={{marginRight: "6px", verticalAlign: "middle"}} /> Settings
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
            <div className="sidebar-resizer" onMouseDown={startResize} />

            {/* Main Panel split into Code Viewer and Review Panel */}
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

                        {/* Right Side: Tabbed Review Panel */}
                        <div className="review-panel">
                            <header className="panel-header">
                                <div className="review-panel-tabs">
                                    <button
                                        className={`review-tab-btn ${reviewTab === 'ai' ? 'active' : ''}`}
                                        onClick={() => handleReviewTabSwitch('ai')}
                                    >
                                        🤖 AI Review
                                    </button>
                                    <button
                                        className={`review-tab-btn ${reviewTab === 'peer' ? 'active' : ''}`}
                                        onClick={() => handleReviewTabSwitch('peer')}
                                    >
                                        👥 Peer Review
                                    </button>
                                </div>

                                {reviewTab === 'ai' && (
                                    <button
                                        className="btn-primary run-review-btn"
                                        onClick={handleRunAIReview}
                                        disabled={loadingReview}
                                    >
                                        {loadingReview ? "Analyzing..." : "Run AI Review"}
                                    </button>
                                )}
                            </header>

                            {/* AI Review Tab */}
                            {reviewTab === 'ai' && (
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
                            )}

                            {/* Peer Review Tab */}
                            {reviewTab === 'peer' && (
                                <div className="review-content">
                                    <div className="peer-review-section">

                                        {/* Status Badge */}
                                        {latestPeerReview ? (
                                            <div>
                                                <span className={getStatusBadgeClass(latestPeerReview.status)}>
                                                    {getStatusLabel(latestPeerReview.status)}
                                                </span>
                                            </div>
                                        ) : (
                                            !loadingPeerReview && (
                                                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No peer reviews yet.</p>
                                            )
                                        )}

                                        {/* Request Review */}
                                        {reviewableMembers.length > 0 && (
                                            <div className="peer-request-row">
                                                <select
                                                    className="peer-request-select"
                                                    value={selectedReviewerId}
                                                    onChange={(e) => setSelectedReviewerId(e.target.value)}
                                                >
                                                    <option value="">Select reviewer...</option>
                                                    {reviewableMembers.map((m) => (
                                                        <option key={m.user.id} value={m.user.id}>
                                                            {m.user.name} ({m.role})
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    className="btn-primary run-review-btn"
                                                    onClick={handleRequestPeerReview}
                                                    disabled={!selectedReviewerId}
                                                >
                                                    Request Review
                                                </button>
                                            </div>
                                        )}

                                        {/* Peer Reviews List */}
                                        {loadingPeerReview && (
                                            <div className="loading-card">
                                                <div className="spinner"></div>
                                                <span>Loading peer reviews...</span>
                                            </div>
                                        )}

                                        {!loadingPeerReview && peerReviews.map((pr) => {
                                            const isReviewer = pr.reviewerId === currentUser.id;
                                            const isAuthor = snippetDetails.authorId === currentUser.id;
                                            const canCancel = (isAuthor || isOwnerOrAdmin) && pr.status === 'PENDING';
                                            const canSubmitReview = isReviewer && pr.status === 'PENDING';

                                            return (
                                                <div key={pr.id} className="peer-review-card">
                                                    <div className="peer-reviewer-info">
                                                        <div
                                                            className="peer-avatar"
                                                            style={{ backgroundColor: getAvatarColor(pr.reviewer?.name) }}
                                                        >
                                                            {getUserInitials(pr.reviewer?.name)}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                                                                {pr.reviewer?.name}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                                {new Date(pr.createdAt).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                        <span className={getStatusBadgeClass(pr.status)} style={{ marginLeft: 'auto' }}>
                                                            {getStatusLabel(pr.status)}
                                                        </span>
                                                    </div>

                                                    {pr.comment && (
                                                        <div className="peer-comment-box">
                                                            {pr.comment}
                                                        </div>
                                                    )}

                                                    {canSubmitReview && (
                                                        <div className="peer-review-form">
                                                            <textarea
                                                                className="form-input"
                                                                rows={3}
                                                                placeholder="Leave a comment (optional)..."
                                                                value={reviewComments[pr.id] || ''}
                                                                onChange={(e) =>
                                                                    setReviewComments((prev) => ({ ...prev, [pr.id]: e.target.value }))
                                                                }
                                                                style={{ fontSize: '13px', resize: 'vertical' }}
                                                            />
                                                            <div className="peer-review-actions">
                                                                <button
                                                                    className="btn-approve"
                                                                    onClick={() => handleSubmitReview(pr.id, 'APPROVED')}
                                                                >
                                                                    ✅ Approve
                                                                </button>
                                                                <button
                                                                    className="btn-changes"
                                                                    onClick={() => handleSubmitReview(pr.id, 'CHANGES_REQUESTED')}
                                                                >
                                                                    🔄 Request Changes
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {canCancel && (
                                                        <div style={{ marginTop: '10px' }}>
                                                            <button
                                                                className="btn-danger"
                                                                style={{ fontSize: '12px', padding: '5px 12px' }}
                                                                onClick={() => handleCancelPeerReview(pr.id)}
                                                            >
                                                                Cancel Request
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {!loadingPeerReview && peerReviews.length === 0 && (
                                            <div className="review-empty">
                                                <div className="empty-icon">👥</div>
                                                <h4>No Peer Reviews</h4>
                                                <p>Request a peer review from a workspace member to get human feedback on this snippet.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
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
