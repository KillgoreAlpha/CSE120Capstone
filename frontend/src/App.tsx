import { useState, useEffect, useRef } from 'react';
import { useAuth } from "react-oidc-context";
import {
  Layout,
  Input,
  Button,
  Avatar,
  Typography,
  Space,
  Modal,
  Card,
  Spin,
  message,
  List,
  Empty
} from 'antd';
import {
  SendOutlined,
  PlusOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LoginOutlined,
  LoadingOutlined,
  HistoryOutlined,
  MessageOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface ChatSession {
  sessionId: string;
  title: string;
  timestamp: string;
  messageCount: number;
}

interface ChatMessage {
  role: string;
  content: string;
  timestamp?: string;
}

const API_BASE_URL = 'http://localhost:3000';

const App = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loadingChatSessions, setLoadingChatSessions] = useState(false);
  const auth = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch chat sessions when user is authenticated
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      fetchChatSessions();
    }
  }, [auth.isAuthenticated, auth.user]);

  const fetchChatSessions = async () => {
    if (!auth.user) return;
    
    setLoadingChatSessions(true);
    try {
      const userId = getUserId(auth.user);
      const response = await fetch(`${API_BASE_URL}/chat-sessions/${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat sessions');
      }
      
      const data = await response.json();
      setChatSessions(data.chatSessions || []);
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      message.error('Failed to load chat history');
    } finally {
      setLoadingChatSessions(false);
    }
  };

  const fetchChatHistory = async (sessionId: string) => {
    if (!auth.user) return;
    
    setIsLoading(true);
    try {
      const userId = getUserId(auth.user);
      const response = await fetch(`${API_BASE_URL}/chat-history/${userId}/${sessionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat history');
      }
      
      const data = await response.json();
      setMessages(data.messages || []);
      setSessionId(data.sessionId);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      message.error('Failed to load chat conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const getUserId = (user: any): string => {
    // Use sub claim as unique user identifier
    return user.profile.sub || user.profile["cognito:username"] || user.profile.email || 'anonymous';
  };

  const toggleSider = () => {
    setCollapsed(!collapsed);
  };

  // Get a display name from the user profile
  interface UserProfile {
    authenticated?: string;
    email?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    sub?: string;
    "cognito:username"?: string;
    [key: string]: any;
  }

  const getUserDisplayName = (profile?: UserProfile): string => {
    if (!profile) return 'User';
    
    // Try to get name from cognito:username (remove any numeric suffixes if present)
    const username = profile.authenticated;
    if (username) {
      // Clean up username if needed (e.g., remove numbers at the end, capitalize)
      const cleanUsername = username.replace(/[0-9]+$/, '');
      return cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);
    }
    
    // Fallback to email prefix
    if (profile.email) {
      const emailName = profile.email.split('@')[0];
      // Capitalize and clean up email prefix
      return emailName.charAt(0).toUpperCase() + emailName.slice(1).replace(/[0-9]+$/, '');
    }
    
    return 'User';
  };

  const signOutRedirect = () => {
    // AWS Cognito client ID
    const clientId = "7n7tk1jf3cvp2u5ftdodr7h36l";
    const logoutUri = import.meta.env.VITE_REDIRECT_URI || window.location.origin;
    const cognitoDomain = "https://us-east-2hmaeqapn8.auth.us-east-2.amazoncognito.com";
    
    // Clear the session and local auth state
    auth.removeUser();
    sessionStorage.clear();
    localStorage.clear();
    
    // Redirect to Cognito logout with client_id and redirect URI
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}&redirect_uri=${encodeURIComponent(logoutUri)}`;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage = inputValue.trim();
    setInputValue('');
    
    // Add user message to chat
    const userMessageObj = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, userMessageObj]);
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Get user ID for chat history tracking
      const userId = auth.user ? getUserId(auth.user) : null;
      
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage,
          sessionId: sessionId,
          userId: userId
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
      
      // Refresh chat sessions list if this is a new chat
      if (auth.isAuthenticated && (!sessionId || sessionId !== data.sessionId)) {
        // Wait a bit for the backend to save the chat before fetching
        setTimeout(() => fetchChatSessions(), 500);
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

  const startNewChat = () => {
    setMessages([]);
    setSessionId(null);
  };
  
  const loadChatSession = (sessionId: string) => {
    fetchChatHistory(sessionId);
  };

  const blurStyle = !auth.isAuthenticated ? {
    filter: 'blur(5px)',
    transition: 'filter 0.3s ease'
  } : {};

  // Loading state
  if (auth.isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        background: '#f5f5f5'
      }}>
        <Spin
          indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />}
          tip="Loading your session..."
        />
      </div>
    );
  }

  // Error state
  if (auth.error) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        padding: '20px',
        background: '#f5f5f5'
      }}>
        <Card title="Authentication Error" style={{ width: 500, maxWidth: '90%' }}>
          <Paragraph type="danger">
            {auth.error.message}
          </Paragraph>
          <Button type="primary" onClick={() => auth.signinRedirect()}>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <Layout style={{ flex: 1, height: '100vh' }}>
      {/* Auth Modal */}
      <Modal
        title={null}
        open={!auth.isAuthenticated}
        footer={null}
        closable={false}
        maskClosable={false}
        centered
        width={400}
        style={{ borderRadius: '16px' }}
        bodyStyle={{ padding: '24px' }}
      >
        <Card variant='borderless'>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <Avatar src={"https://static.wixstatic.com/media/1a1b30_ffdd9eff1dba4c6896bdd859e4bc9839~mv2.png/v1/fill/w_120,h_90,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/logo.png"} size={64} />
              <Title level={3} style={{ marginTop: '16px' }}>X10e</Title>
              <Paragraph type="secondary">
                Sign in to continue or create a new account to get started.
              </Paragraph>
            </div>

            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Button
                type="primary"
                size="large"
                block
                onClick={() => auth.signinRedirect()}
              >
                Sign In / Sign Up
              </Button>
            </Space>
          </Space>
        </Card>
      </Modal>

      {/* Main Layout - with blur effect when not authenticated */}
      <Header style={{
        background: '#fff',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleSider}
          />
          <Title level={4} style={{ margin: 0, marginLeft: 16 }}>X10e</Title>
        </div>
        <Space>
          {auth.isAuthenticated && (
            <Button
              type="text"
              icon={<LoginOutlined />}
              onClick={() => signOutRedirect()}
            >
              Logout
            </Button>
          )}
          <Avatar icon={<UserOutlined />} />
          {auth.isAuthenticated && (
            <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column' }}>
              <Text strong ellipsis>
                {getUserDisplayName(auth.user?.profile)}
              </Text>
              <Text type="secondary" style={{ fontSize: '12px' }} ellipsis>
                {auth.user?.profile.email}
              </Text>
            </div>
          )}
        </Space>
      </Header>

      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        <Sider
          width={260}
          collapsible
          collapsed={collapsed}
          trigger={null}
          style={{
            background: '#f0f2f5',
            height: '100%',
            overflow: 'auto',
            ...blurStyle
          }}
        >
          <div style={{ padding: '16px' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ width: '100%' }}
              onClick={startNewChat}
            >
              {!collapsed && 'New chat'}
            </Button>
            
            {!collapsed && (
              <div style={{ margin: '16px 8px 8px 8px' }}>
                <Space align="center">
                  <HistoryOutlined />
                  <Text strong>Chat History</Text>
                </Space>
              </div>
            )}
          </div>

          {loadingChatSessions ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <Spin size="small" />
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary">Loading chats...</Text>
              </div>
            </div>
          ) : chatSessions.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No chat history yet"
              style={{ margin: '24px 0' }}
            />
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={chatSessions}
              style={{ 
                background: '#f0f2f5', 
                border: 'none',
                padding: '0 16px'
              }}
              renderItem={(item) => (
                <List.Item
                  style={{ 
                    padding: '8px 0',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f0f0f0'
                  }}
                  onClick={() => loadChatSession(item.sessionId)}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<MessageOutlined />} size="small" />}
                    title={<Text style={{ fontSize: '14px' }} ellipsis>{item.title}</Text>}
                    description={
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {new Date(item.timestamp).toLocaleDateString()} • {item.messageCount} messages
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Sider>

        <Content style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          height: '100%',
          overflow: 'hidden',
          ...blurStyle
        }}>
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {messages.length === 0 ? (
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center' 
              }}>
                <Text type="secondary">
                  How can I help you today?
                </Text>
              </div>
            ) : (
              <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                {messages.map((msg, index) => (
                  <div 
                    key={index} 
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
                        borderRadius: '8px',
                      }}
                      bodyStyle={{ padding: '12px 16px' }}
                    >
                      <div style={{ 
                        display: 'flex',
                        marginBottom: '4px'
                      }}>
                        <Avatar 
                          size="small" 
                          icon={msg.role === 'user' ? <UserOutlined /> : null}
                          src={msg.role === 'assistant' ? "https://static.wixstatic.com/media/1a1b30_ffdd9eff1dba4c6896bdd859e4bc9839~mv2.png/v1/fill/w_120,h_90,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/logo.png" : null}
                          style={{ marginRight: '8px' }}
                        />
                        <Text strong>{msg.role === 'user' ? 'You' : 'X10e'}</Text>
                      </div>
                      <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
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
                        borderRadius: '8px',
                      }}
                      bodyStyle={{ padding: '12px 16px' }}
                    >
                      <div style={{ display: 'flex', marginBottom: '4px' }}>
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

          <div style={{
            padding: '16px',
            borderTop: '1px solid #f0f0f0',
            background: '#fff',
            position: 'sticky',
            bottom: 0
          }}>
            <div style={{
              maxWidth: '800px',
              margin: '0 auto',
              position: 'relative'
            }}>
              <TextArea
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here..."
                autoSize={{ minRows: 1, maxRows: 6 }}
                style={{
                  paddingRight: '40px',
                  borderRadius: '8px'
                }}
                disabled={isLoading}
              />
              <Button
                type="primary"
                shape="circle"
                icon={<SendOutlined />}
                style={{
                  position: 'absolute',
                  right: '8px',
                  bottom: '8px'
                }}
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
              />
            </div>
            <div style={{
              textAlign: 'center',
              marginTop: '8px'
            }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                X10e's LLM can make mistakes. If you are feeling unwell, please schedule an appointment with your healthcare provider.
                If this is an emergency, please call 911.
              </Text>
            </div>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;