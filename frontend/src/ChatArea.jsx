import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { apiRequest } from './api';
import './ChatArea.css'; // Importing its own separate stylesheet
import SnippetsArea from './SnippetsArea';
import GitHubArea from './GitHubArea';
import SettingsArea from './SettingsArea';


export default function ChatArea({ workspace, onBackToWorkspaces, currentUser, onUserUpdate, onWorkspaceUpdate }) {
    const [channels, setChannels] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [showChannelModal, setShowChannelModal] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [activeTab, setActiveTab] = useState('chat');
    const [error, setError] = useState('');
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editInput, setEditInput] = useState('');

    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('sidebarWidth');
        return saved ? parseInt(saved, 10) : 280;
    });

    const startResize = (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = sidebarWidth;

        const doDrag = (moveEvent) => {
            const currentWidth = startWidth + (moveEvent.clientX - startX);
            if (currentWidth >= 200 && currentWidth <= 480) {
                setSidebarWidth(currentWidth);
                localStorage.setItem('sidebarWidth', currentWidth.toString());
            }
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        };

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    };

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);

    // 1. Fetch channels & members when workspace changes
    useEffect(() => {
        fetchChannels();
        fetchMembers();
    }, [workspace.id]);

    // 2. Manage Socket.IO connection
    useEffect(() => {
        const token = localStorage.getItem('token');
        socketRef.current = io('http://localhost:5000', {
            auth: { token }
        });

        socketRef.current.on('connect', () => {
            console.log('Connected to chat server');
        });

        socketRef.current.on('new_message', (msg) => {
            // Append message if it belongs to current active channel
            if (selectedChannel && msg.channelId === selectedChannel.id) {
                setMessages((prev) => [...prev, msg]);
            }
        });

        socketRef.current.on('error', (err) => {
            console.error('Socket error:', err);
        });

        socketRef.current.on('message_edited', (updatedMsg) => {
            setMessages((prev) =>
                prev.map((msg) => (msg.id === updatedMsg.id ? updatedMsg : msg))
            );
        });

        socketRef.current.on('message_deleted', ({ messageId }) => {
            setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [selectedChannel?.id]);

    // 3. Join / Leave Channel when channel selection changes
    useEffect(() => {
        if (!selectedChannel) return;

        // Fetch message history for the channel
        fetchMessageHistory(selectedChannel.id);

        // Join room
        socketRef.current.emit('join_channel', { channelId: selectedChannel.id });

        return () => {
            socketRef.current.emit('leave_channel', { channelId: selectedChannel.id });
        };
    }, [selectedChannel]);

    // 4. Scroll to bottom of chat when messages update
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchChannels = async () => {
        try {
            const data = await apiRequest(`/channels?workspaceId=${workspace.id}`);
            setChannels(data);
            if (data.length > 0) {
                // Automatically select the 'general' channel
                const general = data.find(c => c.name.toLowerCase() === 'general') || data[0];
                setSelectedChannel(general);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const fetchMembers = async () => {
        try {
            const data = await apiRequest(`/workspaces/${workspace.id}/members`);
            setMembers(data);
        } catch (err) {
            setError(err.message);
        }
    };

    const fetchMessageHistory = async (channelId) => {
        try {
            const data = await apiRequest(`/channels/${channelId}/messages`);
            setMessages(data);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!messageInput.trim() || !selectedChannel) return;

        // Emit message to Socket server
        socketRef.current.emit('send_message', {
            channelId: selectedChannel.id,
            content: messageInput.trim()
        });

        setMessageInput('');
    };

    const handleCreateChannel = async (e) => {
        e.preventDefault();
        if (!newChannelName.trim()) return;

        try {
            const data = await apiRequest('/channels', {
                method: 'POST',
                body: JSON.stringify({
                    workspaceId: workspace.id,
                    name: newChannelName.trim().toLowerCase(),
                    type: 'CHAT'
                })
            });

            setChannels((prev) => [...prev, data.channel]);
            setSelectedChannel(data.channel); // Switch to the new channel
            setNewChannelName('');
            setShowChannelModal(false);
        } catch (err) {
            alert(err.message);
        }
    };

    const getUserInitials = (name) => {
        if (!name) return 'U';
        return name.substring(0, 2).toUpperCase();
    };

    const handleEditMessage = (messageId, newContent) => {
        if (!newContent.trim()) return;
        socketRef.current.emit('edit_message', {
            messageId,
            content: newContent.trim()
        });
    };

    const handleDeleteMessage = (messageId) => {
        if (window.confirm("Are you sure you want to delete this message?")) {
            socketRef.current.emit('delete_message', { messageId });
        }
    };

    if (activeTab === 'snippets') {
        return (
            <SnippetsArea
                workspace={workspace}
                currentUser={currentUser}
                onBackToWorkspaces={onBackToWorkspaces}
                members={members}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                sidebarWidth={sidebarWidth}
                startResize={startResize}
            />
        );
    }

    if (activeTab === 'github') {
        return (
            <GitHubArea
                workspace={workspace}
                currentUser={currentUser}
                onBackToWorkspaces={onBackToWorkspaces}
                members={members}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                sidebarWidth={sidebarWidth}
                startResize={startResize}
            />
        );
    }

    if (activeTab === 'settings') {
        return (
            <SettingsArea
                workspace={workspace}
                currentUser={currentUser}
                onBackToWorkspaces={onBackToWorkspaces}
                members={members}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onUserUpdate={onUserUpdate}
                onMembersUpdate={fetchMembers}
                onWorkspaceUpdate={onWorkspaceUpdate}
                sidebarWidth={sidebarWidth}
                startResize={startResize}
            />
        );
    }



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
                    {/* Channels Header */}
                    <div className="sidebar-section-title">
                        <span>Channels</span>
                        <button className="btn-add" onClick={() => setShowChannelModal(true)}>
                            +
                        </button>
                    </div>
                    <ul className="sidebar-list">
                        {channels.map((chan) => (
                            <li
                                key={chan.id}
                                className={`sidebar-item ${selectedChannel?.id === chan.id ? 'active' : ''}`}
                                onClick={() => setSelectedChannel(chan)}
                            >
                                # {chan.name}
                            </li>
                        ))}
                    </ul>

                    {/* Members Header */}
                    <div className="sidebar-section-title">
                        <span>Workspace Members</span>
                    </div>
                    <ul className="sidebar-list">
                        {members.map((memberObj) => (
                            <li key={memberObj.user.id} className="sidebar-item sidebar-member" style={{ cursor: 'default' }}>
                                <span className="user-avatar member-avatar">
                                    {getUserInitials(memberObj.user.name)}
                                </span>
                                <span>{memberObj.user.name}</span>
                                <span className="member-role">{memberObj.role}</span>
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

            {/* Main Chat Panel */}
            <main className="chat-main">
                {selectedChannel ? (
                    <>
                        <header className="chat-header">
                            <h3># {selectedChannel.name}</h3>
                            <span className="channel-type-badge">
                                {selectedChannel.type} Channel
                            </span>
                        </header>

                        <div className="chat-messages">
                            {messages.length === 0 ? (
                                <div className="chat-empty-state">
                                    No messages here yet. Be the first to type!
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isOwnMessage = msg.senderId === currentUser.id;
                                    const isEditing = editingMessageId === msg.id;
                                    return (
                                        <div key={msg.id} className="message-card">
                                            <span className="user-avatar message-avatar">
                                                {getUserInitials(msg.sender?.name || msg.sender?.username)}
                                            </span>
                                            <div className="message-content-wrapper" style={{ flex: 1, minWidth: 0 }}>
                                                <div className="message-meta">
                                                    <span className="message-sender">{msg.sender?.name || 'User'}</span>
                                                    <span className="message-time">
                                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {msg.edited && <span className="message-edited-badge" style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: '6px' }}>(edited)</span>}
                                                </div>

                                                {isEditing ? (
                                                    <form onSubmit={(e) => {
                                                        e.preventDefault();
                                                        handleEditMessage(msg.id, editInput);
                                                        setEditingMessageId(null);
                                                    }} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                        <input
                                                            type="text"
                                                            value={editInput}
                                                            onChange={(e) => setEditInput(e.target.value)}
                                                            className="chat-input"
                                                            style={{ flex: 1, padding: '4px 8px', fontSize: '0.9rem' }}
                                                        />
                                                        <button type="submit" className="btn-primary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Save</button>
                                                        <button type="button" className="btn-secondary" onClick={() => setEditingMessageId(null)} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Cancel</button>
                                                    </form>
                                                ) : (
                                                    <div className="message-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                                                        <span style={{ wordBreak: 'break-word', flex: 1 }}>{msg.content}</span>
                                                        {isOwnMessage && (
                                                            <div className="message-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingMessageId(msg.id);
                                                                        setEditInput(msg.content);
                                                                    }}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.6 }}
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteMessage(msg.id)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.6 }}
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>


                        <form className="chat-input-area" onSubmit={handleSendMessage}>
                            <div className="chat-input-wrapper">
                                <input
                                    type="text"
                                    className="chat-input"
                                    placeholder={`Message #${selectedChannel.name}`}
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                />
                                <button type="submit" className="btn-primary btn-send-message">
                                    Send
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="chat-no-selection">
                        Select a channel to start chatting!
                    </div>
                )}
            </main>

            {/* Create Channel Modal */}
            {
                showChannelModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3 className="modal-title">Create New Channel</h3>
                            <form onSubmit={handleCreateChannel}>
                                <div className="form-group">
                                    <label className="form-label">Channel Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. engineering"
                                        value={newChannelName}
                                        onChange={(e) => setNewChannelName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="modal-buttons">
                                    <button type="button" className="btn-secondary" onClick={() => setShowChannelModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                                        Create
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
