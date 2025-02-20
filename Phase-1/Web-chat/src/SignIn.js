import React, { useState } from 'react';
import './SignIn.scss';
import logo from './LogoX.png';
import ForgotPasswordModal from './ForgotPassword';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import'./admin.js'


function SignIn({ onSignIn }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        console.log('Email:', username);
        console.log('Password:', password);

        const adminE = 'admin@X10E.com'
        const adminP = 'adminadmin'

        if (username === adminE && password === adminP) {
        navigate('/admin');
        return;
    }


        const signInData = {
            email: username,
            password: password,
        };

        try {
            const response = await fetch('http://localhost:4000/signIn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(signInData)
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Sign-in successful:', data);

                onSignIn({email: signInData.email, fname: data.first_name, lname: data.last_name});

                navigate('/chat');
            } else {
                const errorData = await response.json();
                alert('Error signing in: ' + errorData.error);
            }
        } catch (error) {
            console.error('Error signing in:', error);
            alert('An error occurred during sign-in');
        }

    };



    const handleForgotPassword = (email) => {
        console.log('Email for password reset:', email);
    };

    return (
        <div className="sign-in-app">
            <div className="line-1 anim-typewriter">
                <p>Welcome to the best health chat bot</p>
            </div>
            <div className="backdrop">
                <div className="sign-in-container">
                    <h2 className="sign-in-title"></h2>
                    <p className="sign-in-subtitle">Sign-In</p>
                    <form onSubmit={handleSubmit}>
                        <input
                            type="text"
                            className="sign-in-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username"
                            required
                        />
                        <div className="password-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="sign-in-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                required
                            />
                            <span
                                className="password-toggle-icon"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <FaEyeSlash /> : <FaEye />}
                            </span>
                        </div>
                        <div className="sign-in-form-group">
                            <input
                                type="checkbox"
                                className="sign-in-checkbox"
                            />
                            <label className="sign-in-checkbox-label">
                                Remember me
                            </label>
                            <a
                                href="#"
                                className="forgot-pass"
                                onClick={() => setIsModalOpen(true)}
                            >
                                Forgot password?
                            </a>
                        </div>
                        <button type="submit" className="sign-in-button">
                            Sign In
                        </button>
                        <button
                            type="button"
                            className="sign-up-button"
                            onClick={() => navigate('/signup')}
                        >
                            Sign Up
                        </button>
                    </form>
                </div>
            </div>

            {/* Forgot Password Modal */}
            <ForgotPasswordModal
                show={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleForgotPassword}
            />
        </div>
    );
}

export default SignIn;