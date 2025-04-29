import { useState, useEffect, useCallback } from 'react';
import { useAuth } from "react-oidc-context";
import {
  Layout,
  Button,
  Avatar,
  Typography,
  Space,
  Modal,
  Card,
  Spin,
  message,
  List,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LoginOutlined,
  LoadingOutlined,
  HistoryOutlined,
  MessageOutlined,
  DeleteOutlined
} from '@ant-design/icons';

// Import our components
import HealthDashboard from './components/HealthDashboard';
import ChatPanel from './components/ChatPanel';
import UserHealthProfileForm from './components/UserHealthProfileForm';
import { useUserHealthProfile } from './hooks/useUserHealthProfile';

const { Header, Sider, Content } = Layout;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loadingChatSessions, setLoadingChatSessions] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const auth = useAuth();
  
  // Define getUserId function
  const getUserId = (user: any): string => {
    // Use sub claim as unique user identifier
    return user?.profile?.sub || user?.profile?.["cognito:username"] || user?.profile?.email || 'anonymous';
  };
  
  // Add user health profile functionality
  const {
    profileData,
    showProfileForm,
    setShowProfileForm,
    saveProfile
  } = useUserHealthProfile(auth.isAuthenticated && auth.user ? getUserId(auth.user) : null);

  const fetchChatSessions = useCallback(async () => {
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
  }, [auth.user]);
  
  // Fetch chat sessions when user is authenticated
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      fetchChatSessions();
    }
  }, [auth.isAuthenticated, auth.user, fetchChatSessions]);

  const fetchChatHistory = async (sessionId: string) => {
    if (!auth.user) return;
    
    try {
      const userId = getUserId(auth.user);
      const response = await fetch(`${API_BASE_URL}/chat-history/${userId}/${sessionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat history');
      }
      
      const data = await response.json();
      setMessages(data.messages || []);
      setSessionId(data.sessionId);
      setChatExpanded(true);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      message.error('Failed to load chat conversation');
    }
  };

  // getUserId function already defined above

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
    
    // First priority: given_name (first name)
    if (profile.given_name) {
      return profile.given_name;
    }
    
    // Second priority: name, take first part if it has spaces
    if (profile.name) {
      const firstName = profile.name.split(' ')[0];
      return firstName;
    }
    
    // Third priority: cognito username
    const username = profile.authenticated || profile["cognito:username"];
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

  const startNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setChatExpanded(true);
  };
  
  const loadChatSession = (sessionId: string) => {
    fetchChatHistory(sessionId);
  };
  
  // Function to delete a chat session
  const deleteChatSession = async (chatId: string, e: React.MouseEvent) => {
    // Stop the click event from propagating to the list item
    e.stopPropagation();
    
    if (!auth.user) return;
    
    try {
      const userId = getUserId(auth.user);
      const response = await fetch(`${API_BASE_URL}/chat-session/${userId}/${chatId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete chat session');
      }
      
      // If the currently active session is deleted, clear the messages
      if (chatId === sessionId) {
        setMessages([]);
        setSessionId(null);
      }
      
      // Refresh the chat sessions list
      fetchChatSessions();
      message.success('Chat deleted successfully');
    } catch (error) {
      console.error('Error deleting chat session:', error);
      message.error('Failed to delete chat');
    }
  };

  const toggleChatExpanded = () => {
    setChatExpanded(!chatExpanded);
  };
  
  // Handle profile form completion
  const handleProfileComplete = async (profileData: any) => {
    if (auth.isAuthenticated && auth.user) {
      try {
        // Use the saveProfile function from the hook instead of making a direct API call
        // This will update both the server and the local state
        await saveProfile(profileData);
        
        console.log('Successfully saved profile to server');
        
        // The hook will automatically update state and hide the form after successful save
        // No need to call setShowProfileForm(false) here
      } catch (error) {
        console.error('Error saving profile:', error);
        message.error('Failed to save health profile');
      }
    }
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
        />
        <div style={{ marginTop: '16px' }}>
          Loading your session...
        </div>
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
            <Space>
              <Button
                type="text"
                icon={<UserOutlined />}
                onClick={() => setShowProfileForm(true)}
              >
                Profile
              </Button>
              <Button
                type="text"
                icon={<LoginOutlined />}
                onClick={() => signOutRedirect()}
              >
                Logout
              </Button>
            </Space>
          )}
          <Avatar icon={<UserOutlined />} />
          {auth.isAuthenticated && (
            <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column' }}>
              <Text strong ellipsis style={{ maxWidth: '150px' }}>
                {getUserDisplayName(auth.user?.profile)}
              </Text>
              <Text type="secondary" style={{ fontSize: '12px', maxWidth: '150px' }} ellipsis>
                {auth.user?.profile.email}
              </Text>
            </div>
          )}
        </Space>
      </Header>

      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        <Sider
          width={260}
          collapsedWidth={80}
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

          {/* Only show chat history when sidebar is expanded */}
          {!collapsed && (
            <>
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
                        borderBottom: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onClick={() => loadChatSession(item.sessionId)}
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<MessageOutlined />} size="small" />}
                        title={
                          <div style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </div>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {new Date(item.timestamp).toLocaleDateString()} • {item.messageCount} messages
                          </Text>
                        }
                      />
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => deleteChatSession(item.sessionId, e)}
                        style={{ marginLeft: '8px' }}
                      />
                    </List.Item>
                  )}
                />
              )}
            </>
          )}
        </Sider>

        <Content style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          height: '100%',
          overflow: 'hidden',
          ...blurStyle
        }}>
          {/* Welcome and Health Status Section */}
          <div style={{ padding: '20px 20px 10px 20px' }}>
            <Title level={4} style={{ margin: 0 }}>
              Hello, {getUserDisplayName(auth.user?.profile)}! 
            </Title>
          </div>
          
          {/* Health Dashboard Section */}
          <HealthDashboard 
            userId={auth.user ? getUserId(auth.user) : null}
            isVisible={!chatExpanded}
          />
          
          {/* Chat Panel Section */}
          <ChatPanel
            userId={auth.user ? getUserId(auth.user) : null}
            messages={messages}
            setMessages={setMessages}
            sessionId={sessionId}
            setSessionId={setSessionId}
            expanded={chatExpanded}
            onToggleExpand={toggleChatExpanded}
            userHealthProfile={profileData}
            onChatSessionUpdated={fetchChatSessions}
          />
        </Content>
      </Layout>
      
      {/* User Health Profile Form */}
      {auth.isAuthenticated && (
        <UserHealthProfileForm
          userId={auth.user ? getUserId(auth.user) : null}
          visible={showProfileForm}
          onClose={() => setShowProfileForm(false)} 
          onComplete={handleProfileComplete}
        />
      )}
    </Layout>
  );
};

export default App;