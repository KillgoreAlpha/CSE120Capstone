import React, { useState, useRef, useEffect } from 'react';
import { 
  Input, 
  Button, 
  Avatar, 
  Typography, 
  Card,
  Spin, 
  message 
} from 'antd';
import { 
  SendOutlined,
  UserOutlined,
  LoadingOutlined,
  AudioOutlined
} from '@ant-design/icons';
import { useDictation } from '../hooks/useDictation';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface ChatMessage {
  role: string;
  content: string;
  timestamp?: string;
}

// Import UserHealthProfile type
import { UserHealthProfile } from '../hooks/useUserHealthProfile';

interface ChatPanelProps {
  userId: string | null;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sessionId: string | null;
  setSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  expanded: boolean;
  onToggleExpand: () => void;
  userHealthProfile: UserHealthProfile | null;
  onChatSessionUpdated?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
  userId, 
  messages, 
  setMessages, 
  sessionId, 
  setSessionId,
  expanded,
  onToggleExpand,
  userHealthProfile,
  onChatSessionUpdated
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const API_BASE_URL = 'http://localhost:3000';

  const { isListening: isDictating, transcript, start, stop } = useDictation();

  useEffect(() => {
    if (transcript) {
      setInputValue(prev => prev + (prev ? ' ' : '') + transcript);
    }
  }, [transcript]);

  // Touch event handlers for swiping
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startY.current) return;
    
    const currentY = e.touches[0].clientY;
    const diff = startY.current - currentY;
    
    // Swipe up (expand) or down (collapse)
    if (Math.abs(diff) > 50) {
      if (diff > 0 && !expanded) {
        onToggleExpand(); // Expand
      } else if (diff < 0 && expanded) {
        onToggleExpand(); // Collapse
      }
      startY.current = null;
    }
  };
  
  // Function to scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // The onChatSessionUpdated is already available from the destructured props

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage = inputValue.trim();
    setInputValue('');
    
    // Add user message to chat
    const userMessageObj = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, userMessageObj]);
    
    // Set loading state
    setIsLoading(true);
    
    // Debug log to see what profile data we're sending
    console.log("Sending user health profile:", userHealthProfile);
    if (!userHealthProfile) {
      console.warn("No user health profile data available to send to the LLM");
    }
    
    try {
      // Get user ID for chat history tracking
      
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage,
          sessionId: sessionId,
          userId: userId,
          userHealthProfile: userHealthProfile
        }),
      });
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      const data = await response.json();
      
      // Save the session ID for future requests
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }
      
      // Add assistant response to chat
      const assistantMessageObj = { role: 'assistant', content: data.response };
      setMessages(prev => [...prev, assistantMessageObj]);
      
      // Notify parent component that chat history has been updated
      if (onChatSessionUpdated && userId) {
        onChatSessionUpdated();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      message.error('Failed to send message. Please try again.');
      
      // Add error message to chat
      const errorMessageObj = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request. Please try again.' 
      };
      setMessages(prev => [...prev, errorMessageObj]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: { key: string; shiftKey: any; preventDefault: () => void; }) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Check if it's a mobile device
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div 
      ref={panelRef}
      className={`chat-panel ${expanded ? 'expanded' : ''}`}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: expanded ? '80%' : '200px',
        background: '#fff',
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px',
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease-in-out',
        zIndex: 1000
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {/* Mobile Chat Tab */}
      {isMobile && (
        <div 
          className="chat-panel-tab"
          onClick={onToggleExpand}
        >
          <Text strong style={{ fontSize: '16px' }}>Chat with X10e</Text>
        </div>
      )}
      
      {/* Swipe indicator - only show when expanded on mobile */}
      {(!isMobile || expanded) && (
        <div 
          className="chat-panel-handle"
          style={{
            width: '50px',
            height: '5px',
            background: '#e0e0e0',
            borderRadius: '10px',
            margin: '10px auto',
            cursor: 'pointer'
          }}
          onClick={onToggleExpand}
        />
      )}
      
      {/* Messages area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '0 20px 20px',
        WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
      }}>
        {messages.length === 0 ? (
          <div style={{ 
            height: '100%', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            flexDirection: 'column',
            padding: '0 16px',
            textAlign: 'center'
          }}>
            <Text type="secondary" style={{ fontSize: '16px', marginBottom: '8px' }}>
              How can I help you today?
            </Text>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              Ask me about your health metrics or general health questions.
            </Text>
          </div>
        ) : (
          <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className="chat-message"
                style={{ 
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <Card 
                  style={{ 
                    maxWidth: '80%',
                    background: msg.role === 'user' ? '#e6f7ff' : '#f5f5f5',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  }}
                  bodyStyle={{ padding: '12px 16px' }}
                >
                  <div style={{ 
                    display: 'flex',
                    marginBottom: '4px',
                    alignItems: 'center'
                  }}>
                    <Avatar 
                      size="small" 
                      icon={msg.role === 'user' ? <UserOutlined /> : null}
                      src={msg.role === 'assistant' ? "https://static.wixstatic.com/media/1a1b30_ffdd9eff1dba4c6896bdd859e4bc9839~mv2.png/v1/fill/w_120,h_90,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/logo.png" : null}
                      style={{ marginRight: '8px' }}
                    />
                    <Text strong>{msg.role === 'user' ? 'You' : 'X10e'}</Text>
                  </div>
                  <Paragraph style={{ 
                    whiteSpace: 'pre-wrap', 
                    margin: 0,
                    fontSize: '15px',
                    lineHeight: '1.5'
                  }}>
                    {msg.content}
                  </Paragraph>
                </Card>
              </div>
            ))}
            {isLoading && (
              <div style={{ 
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start'
              }}>
                <Card
                  style={{
                    maxWidth: '80%',
                    background: '#f5f5f5',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  }}
                  bodyStyle={{ padding: '12px 16px' }}
                >
                  <div style={{ 
                    display: 'flex', 
                    marginBottom: '4px',
                    alignItems: 'center'
                  }}>
                    <Avatar 
                      size="small" 
                      src="https://static.wixstatic.com/media/1a1b30_ffdd9eff1dba4c6896bdd859e4bc9839~mv2.png/v1/fill/w_120,h_90,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/logo.png"
                      style={{ marginRight: '8px' }}
                    />
                    <Text strong>X10e</Text>
                  </div>
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                </Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Input area */}
      <div 
        className="chat-input-container"
        style={{
          padding: '16px',
          borderTop: '1px solid #f0f0f0',
          background: '#fff'
        }}
      >
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        }}>
          <TextArea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
            autoSize={{ minRows: 1, maxRows: 3 }}
            style={{
              paddingRight: '70px', // Reduced padding for smaller buttons
              borderRadius: '18px',
              fontSize: '14px', // Slightly smaller font
              resize: 'none',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              minHeight: '38px', // Fixed height
              width: '100%',
              lineHeight: '1.4'
            }}
            disabled={isLoading}
          />
          <Button
            shape="circle"
            size="small" // Changed from middle to small
            icon={<SendOutlined style={{ fontSize: '14px' }} />} // Smaller icon
            type="primary"
            style={{ 
              position: 'absolute', 
              right: '32px', // Moved closer to the right to give more space
              top: '50%', // Center vertically
              transform: 'translateY(-50%)', // Precise centering
              width: '28px', // Smaller button size
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
          />
          <Button
            shape="circle"
            size="small" // Changed from middle to small
            icon={<AudioOutlined style={{ fontSize: '14px' }} />} // Smaller icon
            style={{
              position: 'absolute',
              right: '0px',
              top: '50%', // Center vertically
              transform: 'translateY(-50%)', // Precise centering
              backgroundColor: isDictating ? '#1890ff' : undefined,
              color: isDictating ? '#fff' : undefined,
              borderColor: isDictating ? '#1890ff' : undefined,
              width: '28px', // Smaller button size
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={isDictating ? stop : start}
            disabled={isLoading}
          />
        </div>
        
        <div style={{
          textAlign: 'center',
          marginTop: '8px'
        }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            X10e's LLM can make mistakes. If you are feeling unwell, please schedule an appointment with your healthcare provider.
          </Text>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;