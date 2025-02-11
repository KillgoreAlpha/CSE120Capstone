import React, { useState } from 'react';
import './App.scss';

function ForgotPasswordModal({ show, onClose, onSubmit }) {
    const [email, setEmail] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(email);
        setEmail('');
        onClose();
    };

    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <p className = "ForgotPassTxt">Forgot Password</p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="email"
                        className="modal-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                    />
                    <div className="modal-buttons">
                        <button type="submit" className="modal-submit">Submit</button>
                        <button type="button" className="x-close" onClick={onClose}>X</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ForgotPasswordModal;