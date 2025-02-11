import './App.scss';
import logo from './LogoX.png';
import React, { useState } from 'react';
import SignIn from './SignIn';
import SignUp from './SignUp';
import ChatBox from './ChatBox';
import HealthProfile from './HealthProfile';
import SettingsPage from './settings';
import {BrowserRouter as Router, Routes, Route, Navigate, useLocation} from 'react-router-dom';
import AdminPage from './admin.js';
import { useNavigate } from 'react-router-dom';

function App() {
    //const navigate = useNavigate();
    const [isSignedIn, setIsSignedIn] = useState(false);

    const handleSignIn = (account) => {
        if (!account || !account.email) {
        console.log('Invalid account object:', account);
        return;
        }
        console.log('handleSignIn called with:', account);
        setIsSignedIn(true);
        const k = localStorage.getItem('chat_history_id'+account.email)
        localStorage.setItem('chat_history_id'+account.email, k===''&&'0'||((+k)))
        console.log(localStorage.getItem('chat_history_id'+account.email))
        localStorage.setItem('email', account.email);
        localStorage.setItem('fname', account.fname);
        localStorage.setItem('lname', account.lname);
        localStorage.setItem('current_chat_id','-1');
        //navigator('/chat')
    };

    const handleSignOut = (chats, msg) => {
        const email = localStorage.getItem('email');
        const id = localStorage.getItem('chat_history_id'+email)
        if(msg.length!==0) {
            localStorage.setItem('chat_history' + email + id, msg.map(x => `[${x.sender}(SEP)${x.text}]`).join('(END)'));
            localStorage.setItem('chat_history_id' + email, (+id) + 1)
        }
        setIsSignedIn(false);
        localStorage.setItem('email','');
        localStorage.setItem('fname','');
        localStorage.setItem('lname','');
        localStorage.setItem('current_chat_id','-1');
        window.location.href='/';
    };

    return (
        <Router>
            <img className="logo" src={logo} alt="Logo" />

            <div className="wave-container">
                <div className="wave"></div>
                <div className="wave"></div>
                <div className="wave"></div>
            </div>

            <Routes>
                 <Route path="/admin" element={
                     <AdminPage/>
                 }/>

                <Route path="/" element={
                    (localStorage.getItem('email')!='') ? (
                        <Navigate to="/chat"/>
                    ) : (
                        <Navigate to="/signin" />
                    )
                }/>
                <Route path="/signin" element={
                    (localStorage.getItem('email')!='') ? (
                        <Navigate to="/chat"/>
                    ) : (
                        <SignIn onSignIn={handleSignIn} />
                    )
                } />
                <Route path="/signup" element={
                    (localStorage.getItem('email')!='') ? (
                        <Navigate to="/chat"/>
                    ) : (
                        <SignUp onSignIn={handleSignIn} />
                        )
                    } />
                <Route
                    path="/chat"
                    element={
                        (localStorage.getItem('email')!='') ? (
                            <ChatBox onSignOut={handleSignOut} />
                        ) : (
                            <Navigate to="/signin" />
                        )
                    }
                />
                <Route
                    path="/settings"
                    element={
                        (localStorage.getItem('email')!='') ? (
                            <SettingsPage onBack={() => window.history.back()} />
                        ) : (
                            <Navigate to="/signin" />
                        )
                    }
                />
                <Route path="/health-profile" element={
                    (localStorage.getItem('email') !== '') ? (
                        <HealthProfile />
                    ) : (
                        <Navigate to="/signin" />
                    )
                } />
                <Route path="*" element={<Navigate to="/signin" />} />
            </Routes>
        </Router>
    );
}

export default App;