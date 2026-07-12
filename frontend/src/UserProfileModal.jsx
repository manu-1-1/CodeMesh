import { useState } from 'react';
import { apiRequest } from './api';
import './UserProfileModal.css';

export default function UserProfileModal({ currentUser, onClose, onUserUpdate }) {
    const [name, setName] = useState(currentUser.name || '');
    const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [profileSuccess, setProfileSuccess] = useState('');
    const [error, setError] = useState('');

    const getUserInitials = (name) => {
        if (!name) return 'U';
        return name.substring(0, 2).toUpperCase();
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

            if (onUserUpdate) {
                onUserUpdate(updatedUser);
            }

            setProfileSuccess('Profile details updated successfully!');
            setTimeout(() => onClose(), 1500); // Close after 1.5 seconds on success
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingProfile(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content profile-modal">
                <header className="modal-header">
                    <h2>Edit Profile</h2>
                    <button className="btn-close-modal" onClick={onClose}>&times;</button>
                </header>

                {error && <div className="alert alert-error">{error}</div>}
                {profileSuccess && <div className="alert alert-success">{profileSuccess}</div>}

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

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loadingProfile}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={loadingProfile}>
                            {loadingProfile ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
