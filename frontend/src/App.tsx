import { useState, useEffect, useRef } from 'react';
import { useAuth } from "react-oidc-context";
import {
  Layout,
  Menu,
  Input,
  Button,
  Avatar,
  Typography,
  Space,
  Modal,
  Card,
  Spin,
  message
} from 'antd';
import {
  SendOutlined,
  PlusOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LoginOutlined,
  LoadingOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

const App = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleSider = () => {
    setCollapsed(!collapsed);
  };

  const signOutRedirect = () => {
    const clientId = "7n7tk1jf3cvp2u5ftdodr7h36l";
    const logoutUri = import.meta.env.VITE_REDIRECT_URI;
    const cognitoDomain = "https://us-east-2hmaeqapn8.auth.us-east-2.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
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
      const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage,
          sessionId: sessionId
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
            <Text style={{ marginLeft: 8 }} ellipsis>
              {auth.user?.profile.email}
            </Text>
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
          </div>

          <Menu
            mode="inline"
            style={{ background: '#f0f2f5', border: 'none' }}
            items={[
              { key: '1', label: 'Previous chat 1' },
              { key: '2', label: 'Previous chat 2' },
              { key: '3', label: 'Previous chat 3' },
            ]}
          />
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