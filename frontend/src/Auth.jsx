import { useState } from 'react';
import { apiRequest } from './api';

export default function Auth({ onAuthSuccess }) {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            const endpoint = isLogin ? '/auth/login' : '/auth/register';
            const body = isLogin
                ? { email: formData.email, password: formData.password }
                : { name: formData.username, email: formData.email, password: formData.password };

            const data = await apiRequest(endpoint, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (isLogin) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                onAuthSuccess(data.user);
            } else {
                setSuccess('Account created successfully! You can now log in.');
                setIsLogin(true);
                setFormData({ username: '', email: '', password: '' });
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1 className="auth-title">CodeMesh</h1>
                    <p className="auth-subtitle">
                        {isLogin ? 'Sign in to your account' : 'Create your workspace account'}
                    </p>
                </div>
                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}
                <form onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div className="form-group">
                            <label className="form-label">Username</label>
                            <input
                                type="text"
                                name="username"
                                className="form-input"
                                placeholder="developer_jane"
                                value={formData.username}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            type="email"
                            name="email"
                            className="form-input"
                            placeholder="jane@codemesh.io"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            name="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>
                <div className="auth-footer">
                    {isLogin ? (
                        <>
                            New to CodeMesh?{' '}
                            <span className="auth-link" onClick={() => setIsLogin(false)}>
                                Create an account
                            </span>
                        </>
                    ) : (
                        <>
                            Already have an account?{' '}
                            <span className="auth-link" onClick={() => setIsLogin(true)}>
                                Sign in instead
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}