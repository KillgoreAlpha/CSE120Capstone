import React, { useState } from 'react';
import './SignIn.scss';
import logo from './LogoX.png';
import { useNavigate } from 'react-router-dom';

function SignUp({ onSignIn }) {
    const [Fname, setFname] = useState('');
    const [Lname, setLname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Check if passwords match
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        if(password.length < 8 || password.length > 16){
            alert('Password must be of length 8 to 16')
            return;
        }

        console.log('FName:', Fname);
        console.log('LName:', Lname);
        console.log('Email:', email);
        console.log('Password:', password);

        const accountData = {
            first_name: Fname,
            last_name: Lname,
            email: email,
            password: password
        };

        try {
            const response = await fetch('http://localhost:4000/accounts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(accountData)
            });

            if (response.ok) {
                onSignIn({fname: accountData.first_name, lname: accountData.last_name, email: accountData.email});
                navigate('/chat');
            } else {
                const errorData = await response.json();
                alert('Error creating account: ' + errorData.message);
            }
        } catch (error) {
            console.error('Error creating account:', error);
            alert('An error occurred while creating the account');
        }
    };


    return (
        <div className="sign-in-app">
            <div className="line-1 anim-typewriter">
                <p>Create a new account</p>
            </div>
            <div className="backdrop">
                <div className="sign-in-container">
                    <h2 className="sign-in-title"></h2>
                    <p className="sign-in-subtitle">Sign Up</p>
                    <form onSubmit={handleSubmit}>
                        <input
                            type="text"
                            className="sign-in-input"
                            value={Fname}
                            onChange={(e) => setFname(e.target.value)}
                            placeholder="First Name"
                            required
                        />
                        <input
                            type="text"
                            className="sign-in-input"
                            value={Lname}
                            onChange={(e) => setLname(e.target.value)}
                            placeholder="Last Name"
                            required
                        />
                        <input
                            type="email"
                            className="sign-in-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            required
                        />
                        <input
                            type="password"
                            className="sign-in-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            required
                        />
                        <input
                            type="password"
                            className="sign-in-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm Password"
                            required
                        />
                        <button type="submit" className="sign-in-button">
                            Sign Up
                        </button>
                        <button
                            type="button"
                            className="sign-up-button"
                            onClick={() => navigate('/signin')}
                        >
                            Back to Sign In
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default SignUp;