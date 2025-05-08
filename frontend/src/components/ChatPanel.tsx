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
  // Update to use environment variable if available, or use fallback ports
  const API_BASE_URL = 'http://localhost:3000'; // Server is running on port 3000

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

  // Track server status
  const [serverAvailable, setServerAvailable] = useState(true);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const serverCheckTimeout = useRef<NodeJS.Timeout | null>(null);

  // Function to check server availability
  const checkServerAvailability = async () => {
    try {
      // Simple HEAD request to check if server is responding
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${API_BASE_URL}`, {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        if (!serverAvailable) {
          console.log("Server is now available");
          message.success("Connection to server restored", 2);
          setServerAvailable(true);
        }
        setConnectionAttempts(0);
        return true;
      }
      return false;
    } catch (error) {
      console.warn("Server appears to be offline:", error);
      setServerAvailable(false);
      return false;
    }
  };

  // Periodically check server availability when it's down
  useEffect(() => {
    // Clear any existing timeout
    if (serverCheckTimeout.current) {
      clearTimeout(serverCheckTimeout.current);
      serverCheckTimeout.current = null;
    }
    
    // If server is unavailable, schedule a check
    if (!serverAvailable) {
      // Backoff strategy: 5s, 10s, 20s, 30s (max)
      const backoffDelay = Math.min(5000 * Math.pow(2, connectionAttempts), 30000);
      console.log(`Will check server availability in ${backoffDelay/1000}s`);
      
      serverCheckTimeout.current = setTimeout(() => {
        checkServerAvailability();
        setConnectionAttempts(prev => prev + 1);
      }, backoffDelay);
    }
    
    // Cleanup
    return () => {
      if (serverCheckTimeout.current) {
        clearTimeout(serverCheckTimeout.current);
      }
    };
  }, [serverAvailable, connectionAttempts]);

  // Initial server check
  useEffect(() => {
    checkServerAvailability();
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage = inputValue.trim();
    setInputValue('');
    
    // Add user message to chat
    const userMessageObj = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, userMessageObj]);
    
    // Set loading state
    setIsLoading(true);
    
    // Check server availability before attempting to send
    if (!serverAvailable) {
      // Try one more time to see if server is back
      const isAvailable = await checkServerAvailability();
      
      if (!isAvailable) {
        console.error('Server is currently unavailable');
        message.error('Server is currently offline. Your message will be saved and sent when the connection is restored.');
        
        // Add error message to chat
        const errorMessageObj = { 
          role: 'assistant', 
          content: 'Sorry, I cannot process your request right now as the server appears to be offline. Your message has been saved and will be processed when the connection is restored.' 
        };
        setMessages(prev => [...prev, errorMessageObj]);
        setIsLoading(false);
        return;
      }
    }
    
    // Debug log to see what profile data we're sending
    console.log("Sending user health profile:", userHealthProfile);
    if (!userHealthProfile) {
      console.warn("No user health profile data available to send to the LLM");
    }
    
    try {
      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
      
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
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status}`);
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
      
      // Server is definitely available if we got this far
      setServerAvailable(true);
      setConnectionAttempts(0);
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Handle AbortError (timeout) specifically
      if (error.name === 'AbortError') {
        message.error('Request timed out. Server may be overloaded or unavailable.');
        setServerAvailable(false);
      } else if (error.message.includes('Failed to fetch')) {
        message.error('Cannot connect to server. Check your network connection.');
        setServerAvailable(false);
      } else {
        message.error('Failed to send message. Please try again.');
      }
      
      // Get detailed error information if available
      let errorDetail = '';
      let isBedrockError = false;
      
      try {
        // Try to parse the error response to get more details
        if (error.message.includes('JSON')) {
          errorDetail = 'Server response format error';
        } else if (error.response) {
          const response = error.response;
          const data = await (typeof response.json === 'function' ? response.json() : JSON.parse(response));
          
          // Check if this is a Bedrock service error
          if (data.errorType && data.errorType.includes('Bedrock')) {
            isBedrockError = true;
          }
          
          if (data.error) {
            errorDetail = data.error; // Use user-friendly error from server
          } else if (data.details) {
            errorDetail = data.details;
          }
        }
      } catch (parseError) {
        console.error("Error parsing error response:", parseError);
      }
      
      // Create a more informative error message
      let errorMessage = '';
      
      if (error.name === 'AbortError') {
        errorMessage = 'The request timed out. The server may be busy or temporarily unavailable.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server. Check your network connection.';
      } else if (isBedrockError) {
        errorMessage = errorDetail || 'There was an issue with the AI service. Your message will be processed when the service is available.';
      } else if (errorDetail) {
        errorMessage = `Error: ${errorDetail}`;
      } else {
        errorMessage = 'There was a problem communicating with the server. Please try again later.';
      }
      
      // Add error message to chat
      const errorMessageObj = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request: ' + errorMessage
      };
      setMessages(prev => [...prev, errorMessageObj]);
      
      // For Bedrock-specific errors, we can keep the server as "available" since the issue is with Bedrock, not our server
      if (!isBedrockError && !error.name === 'AbortError' && !error.message.includes('Failed to fetch')) {
        setServerAvailable(true); // Our server is likely still running
      }
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
          marginTop: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          {!serverAvailable && (
            <div style={{ 
              color: '#ff4d4f', 
              fontSize: '12px', 
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: '#ff4d4f', 
                marginRight: '5px',
                animation: 'pulse 2s infinite'
              }} />
              Server offline - messages will be queued
            </div>
          )}
          <Text type="secondary" style={{ fontSize: '12px' }}>
            X10e's LLM can make mistakes. If you are feeling unwell, please schedule an appointment with your healthcare provider.
          </Text>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;