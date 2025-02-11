import React, { useState, useEffect, useRef } from 'react';
import './App.scss'; // Import the necessary CSS
import { FaCog, FaSignOutAlt } from 'react-icons/fa';
import Settings from './settings';
import { useNavigate } from 'react-router-dom';
import { FaPlus,FaTrash } from 'react-icons/fa';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThumbsUp, faThumbsDown } from '@fortawesome/free-solid-svg-icons';
import { MdClose } from 'react-icons/md';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';

function Message({ str, sender, textSize }) {
    return (
        <div className={`chat-box-message ${sender}`} style={{ fontSize: textSize }}>
            <div className="chat-box-message-text">
                <ReactMarkdown>{str}</ReactMarkdown>
            </div>
        </div>
    );
}
function Sidebar({ savedChats, user, handleChatClick, handleAddChatClick, deleteChat, activeChatId }) {
    const navigate = useNavigate();
    return (
        <div className="sidebar">
            <div className="saved-chats">
                <h5>Saved Chats</h5>
                <button className="New-chat" onClick={handleAddChatClick}><FaPlus /></button>

                {savedChats.map((chat, index) => (
                    <div
                        key={index}
                        className={`saved-chat ${activeChatId === index ? 'active-chat' : ''}`}
                        onClick={() => handleChatClick(index)}
                    >
                        {chat.title}

                        <button
                            className="delete-chat"
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering the chat click
                                deleteChat(index);
                            }}
                        >
                            <MdClose className="close-icon" />
                        </button>
                    </div>
                ))}
            </div>
            <div className="user-profile" onClick={() => navigate('/health-profile')}>
                <img src={user.image} alt="User" className="user-image" />
                <span className="user-name">{user.name}</span>
            </div>
        </div>
    );
}

function ChatBox({onSignOut}) {
    const [msg, setMsg] = useState([]); // State for messages
    const [input, setInput] = useState(""); // State for input text
    const [isThinking, setIsThinking] = useState(false); // State for bot thinking
    const [isDropdownOpen, setIsDropdownOpen] = useState(false); // State for dropdown visibility
    const [isSettingsOpen, setIsSettingsOpen] = useState(false); // State for settings visibility
    const [textSize, setTextSize] = useState("1em"); // State for text size
    
    const chatBoxRef = useRef(null);
    const [get_current_chat_id, set_current_chat_id] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();
    
    const em = localStorage.getItem('email');
    if(localStorage.getItem('chat_history_id' + em) <= 0 ){
        localStorage.setItem('chat_history_id' + em,0)
    }
    const [get_saved_chats, set_saved_chats] = useState(() => {
        const email = localStorage.getItem('email');
        const savedChats = JSON.parse(localStorage.getItem('saved_chats_' + email) || '[]');
    
        // Regenerate dynamic titles for chats without custom titles
        return savedChats.map((chat, index) => ({
            ...chat,
            title: `Saved Chat ${index + 1}`, // Preserve existing titles, or generate based on index
        }));
    });
    
    const user = { name: `${localStorage.getItem('fname')} ${localStorage.getItem('lname')}`, image: 'user-image.jpg' };
    function loadStored(storedMessages){
        if (storedMessages) {
            setMsg(
                storedMessages
                    .split('(END)')
                    .filter(Boolean) // Avoid empty entries
                    .map(x => {
                        const [sender, text] = x.replace(/^\[|\]$/g, '').split('(SEP)');
                        return { sender, text };
                    })
            );

        } else { setMsg([]) }
    }
    useEffect(() => {
        handleChatClick(get_saved_chats.length-1)
        const savedChats = JSON.parse(localStorage.getItem('saved_chats_' + em) || '[]');
        if (savedChats.length !== get_saved_chats.length) {
            set_saved_chats(savedChats);
        }
    }, []);

    function deleteChat(index) {
        if (get_saved_chats.length > 1) {
            const email = localStorage.getItem('email');
            const updatedChats = get_saved_chats.filter((_, i) => i !== index);
    
            set_saved_chats(updatedChats);
            localStorage.setItem('saved_chats_' + email, JSON.stringify(updatedChats));
    
            for (let i = index; i < updatedChats.length; i++) {
                const nextValue = localStorage.getItem('chat_history' + email + (i + 1));
                if (nextValue !== null) {
                    localStorage.setItem('chat_history' + email + i, nextValue);
                } else {
                    console.warn('No value found for key:', 'chat_history' + email + (i + 1));
                    localStorage.removeItem('chat_history' + email + i);
                }
            }
    
            const chatHistoryId = +localStorage.getItem('chat_history_id' + email) - 1;
            localStorage.setItem('chat_history_id' + email, chatHistoryId);
            localStorage.removeItem('chat_history' + email + updatedChats.length);
        }
    }
    function handleAddChatClick() {
        console.log(get_saved_chats.length)
        if (msg.length == 0 && get_saved_chats.length >= 1) {
            console.warn("NO MESSAGE ");
            return;
        }
        const email = localStorage.getItem('email');
        const id = localStorage.getItem('chat_history_id' + email);
    
        if (get_current_chat_id !== +id) {
            const storedMessages = localStorage.getItem('chat_history' + email + id);
            if (storedMessages === '') {
                set_current_chat_id(+id);
                setMsg([]);
                return;
            }
        }
    
        const lastChat = get_saved_chats[get_saved_chats.length - 1];
        const updatedLastChat = { ...lastChat, title: `Saved Chat ${get_saved_chats.length}` };
        const newChat = { title: 'New Chat', uuid: uuidv4() };
    
        const updatedChats = [...get_saved_chats.slice(0, -1), updatedLastChat, newChat];
        set_saved_chats(updatedChats);
    
        localStorage.setItem('saved_chats_' + email, JSON.stringify(updatedChats));
    
        if (get_current_chat_id === +id) {
            localStorage.setItem(
                'chat_history' + email + id,
                msg.map(x => `[${x.sender}(SEP)${x.text}]`).join('(END)')
            );
        }
    
        localStorage.setItem('chat_history_id' + email, (+id) + 1);
        setMsg([]);
        console.log("ID" + id);
        handleChatClick(get_current_chat_id)
    }
    
    function handleChatClick(index){
        //useEffect(() => {
        const email = localStorage.getItem('email')
        const id = localStorage.getItem('chat_history_id'+email)
        const storedMessages = localStorage.getItem('chat_history'+email+index);
        loadStored(storedMessages)
        
        setInput("");
        set_current_chat_id(index)
        localStorage.setItem('current_chat_id', index.toString());
    }


    //alert(localStorage.getItem('chat_history')
        //.split('(END)').map(x=>({text:x.split(',')[1],sender:x.split(',')[0]})).length)
    const handleSend = () => {
        if (input.trim() !== "" && !isThinking) {
            let name_place = "Name";
            const userMessage = {
                text: `${localStorage.getItem('fname')||'Name'}: ${input}`,
                sender: 'user',
            };

            setMsg([...msg, userMessage]);
            setInput("");
            setIsThinking(true);

            const userId = 1;
            const apiUrl = `http://localhost:5000/chat/${userId}`;
            const email = localStorage.getItem('email')
            const id = get_current_chat_id;
            const currentChat = get_saved_chats[id].uuid;
            console.warn("SENT")
            console.log(currentChat)
            fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: input, chat_id:currentChat, userId: userId}),
            })
                .then(response => response.json())
                .then(data => {
                    const botResponse = {
                        text: data.message,
                        sender: 'bot',
                    };
                    
                    setMsg(prevMessages => {
                        const updatedMessages = [...prevMessages, botResponse];
                        
                        // Save updated messages to localStorage
                        localStorage.setItem(
                            'chat_history' + em + id,
                            updatedMessages.map(x => `[${x.sender}(SEP)${x.text}(SEP)]`).join('(END)')
                        );
                        console.log(updatedMessages)
                        return updatedMessages;
                    });
                    setIsThinking(false);
                    //const email = localStorage.getItem('email')
                    //const length = localStorage.getItem('chat_history_length'+email) || 0
                    //localStorage.setItem('chat_history'+email+length, msg.map(x=>`[${x.sender}(SEP)${x.text}]`).join('(END)'));
                    //alert(localStorage.getItem('chat_history'))
                })
             .catch(error => {
                    console.error("Error fetching data:", error);
                 {/*
                    const errorResponse = {
                        text: "Something is wrong...",
                        sender: 'bot',
                    };


                    setMsg(prevMessages => [...prevMessages, errorResponse]);
                    */}
                    setIsThinking(true);
                });

            // Reset the height of the input to its default size
            if (inputRef.current) {
                inputRef.current.style.height = 'auto';
            }

          
        }
        

    };

    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [msg]);

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey && !isThinking) {
            e.preventDefault(); // Prevent adding new line
            handleSend();
        }
    };

    const handleSignOut = () => {
        onSignOut(get_saved_chats, msg);
    }

    const openSettings = () => {
        setIsSettingsOpen(true);
        setIsDropdownOpen(false);
    };

    const closeSettings = () => {
        setIsSettingsOpen(false);
    };

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };


    const handleInputChange = (e) => {
        setInput(e.target.value);
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${inputRef.current.scrollHeight - 27}px` ; // Set new height
        }
    };

    const handleBlur = () => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto'; // Reset height to default
        }
    };

    const enlargeText = () => {
        setTextSize(prevSize => prevSize === "1em" ? "1.5em" : "1em");
    };



    
    const getPreviousMessages = (messages, currentIndex) => {
        if (currentIndex <= 0) return []; // No previous messages if at the start
        const start = Math.max(0, currentIndex - 1); // Ensure no negative index
        return messages.slice(start, currentIndex + 1); // Include currentIndex
    };
    // Function to write to JSON file
    const handleThumbsUp = (index, previousMessages, currentMessage) => {
        console.log(`Thumbs up for bot message ${index}`);
    
        const feedback = {
            action: "thumbs_up",
            currentMessage,
            previousMessages,
        };
    
        sendFeedbackToServer(feedback);
    };
    
    const handleThumbsDown = (index, previousMessages, currentMessage) => {
        console.log(`Thumbs down for bot message ${index}`);
    
        const feedback = {
            action: "thumbs_down",
            currentMessage,
            previousMessages,
        };
    
        sendFeedbackToServer(feedback);
    };
    
    const sendFeedbackToServer = (feedback) => {
        const apiUrl = "http://localhost:5000/feedback";
    
        fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(feedback),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Failed to save feedback");
                }
                return response.json();
            })
            .then((data) => {
                console.log("Feedback saved:", data.message);
            })
            .catch((error) => {
                console.error("Error saving feedback:", error);
            });
    };
    return (
        <div className="chat-container">
            <Sidebar savedChats={get_saved_chats}user={user} handleChatClick={handleChatClick} handleAddChatClick={handleAddChatClick} deleteChat={deleteChat} activeChatId={get_current_chat_id}/>
            <div className="chat-box">
                <div className="chat-box-header">
                    <h4>Chat with x10e</h4>
                    <div className="dropdown">
                        <button className="dropdown-toggle" onClick={toggleDropdown}>
                            <FaCog/>
                        </button>
                        {isDropdownOpen && (
                            <div className="dropdown-menu">
                                {/*
                                <button className="dropdown-item" onClick={() => navigate('/settings')}>
                                    Settings
                                </button>
                                */}
                                <hr className="line"/>
                                <button className="dropdown-item" onClick={handleSignOut}>
                                    <FaSignOutAlt/> Log Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="chat-box-body" ref={chatBoxRef}>
                {msg.map((message, index) => (
                <div key={index} className="messageContainerStyle">
                    <Message str={message.text} sender={message.sender} textSize={textSize} />
                    {message.sender === 'bot' && (
                    <div className="buttonContainerStyle">
                        <button
                        onClick={() => handleThumbsUp(index, getPreviousMessages(msg, index))}
                        className="buttonStyle"
                        >  <FontAwesomeIcon icon={faThumbsUp} />
                
                        </button>
                        <button
                        onClick={() => handleThumbsDown(index, getPreviousMessages(msg, index))}
                        className="buttonStyle"
                        >
                        <FontAwesomeIcon icon={faThumbsDown} />
                        </button>
                    </div>
                    )}
                </div>
                ))}
                                    
                    {isThinking && (
                        <div className="chat-box-message bot typing-indicator">
                            x10e is typing
                        </div>
                    )}
                </div>
                <div className="chat-box-footer">
                    <textarea
                        ref={inputRef}
                        className="chat-box-input"
                        placeholder="Type your message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        onBlur={handleBlur}
                        disabled={isThinking}
                        rows="1"
                    />
                    <button className="chat-box-send" onClick={handleSend} disabled={isThinking}>
                        Send
                    </button>
                </div>
            </div>
            {isSettingsOpen && (
                <Settings onClose={closeSettings} user={user}/>
            )}
        </div>
    );
}

export default ChatBox;