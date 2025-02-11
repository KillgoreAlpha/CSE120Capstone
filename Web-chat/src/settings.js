import React, { useState } from 'react';
import './App.scss';
import logo from './LogoX.png';

function SettingsPage({ user, onSave, onBack }) {
    const [Fname, setFname] = useState(user.Fname || '');
    const [Lname, setLname] = useState(user.Lname || '');
    const [email, setEmail] = useState(user.email || '');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newPassword && newPassword !== confirmPassword) {
            alert("New passwords do not match");
            return;
        }
        const updatedUser = {
            Fname,
            Lname,
            email,
            password: newPassword || password, // Use new password if provided
        };
        console.log('Updated user info:', updatedUser);
        onSave(updatedUser);
    };

    return (
        <div className="settings-app">
            <div className="line-1 anim-typewriter">
                <p>Settings</p>
            </div>
            <div className="backdrop">
                <div className="settings-container">
                    <h2 className="settings-title"></h2>
                    <p className="settings-subtitle">Update your information</p>
                    <form onSubmit={handleSubmit}>
                        <input
                            type="text"
                            className="settings-input"
                            value={Fname}
                            onChange={(e) => setFname(e.target.value)}
                            placeholder="First Name"
                            required
                        />
                        <input
                            type="text"
                            className="settings-input"
                            value={Lname}
                            onChange={(e) => setLname(e.target.value)}
                            placeholder="Last Name"
                            required
                        />
                        <input
                            type="email"
                            className="settings-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            required
                        />
                        <input
                            type="password"
                            className="settings-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Current Password"
                            required
                        />
                        <input
                            type="password"
                            className="settings-input"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="New Password"
                        />
                        <input
                            type="password"
                            className="settings-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm New Password"
                        />
                        <button type="submit" className="settings-button">Save Changes</button>
                        <button type="button" className="back-button" onClick={onBack}>
                            Back
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default SettingsPage;