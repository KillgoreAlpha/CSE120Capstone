import { useState, useEffect, useCallback, useRef } from 'react';
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
  Drawer,
  Menu,
  Divider,
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
  DeleteOutlined,
  DashboardOutlined,
  SettingOutlined,
  FileTextOutlined
} from '@ant-design/icons';

// Import our components
import HealthDashboard from './components/HealthDashboard';
import ChatPanel from './components/ChatPanel';
import UserHealthProfileForm from './components/UserHealthProfileForm';
import ResearchPapers from './components/ResearchPapers';
import { useUserHealthProfile } from './hooks/useUserHealthProfile';

// Import responsive styles
import './responsive.css';

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
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'research'>('dashboard');
  const auth = useAuth();
  
  // Set up responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check on mount
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
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
  
  // Check if user is admin based on Cognito groups
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!auth.isAuthenticated || !auth.user) {
        setIsAdmin(false);
        return;
      }
      
      // First, check if we can determine admin status from Cognito groups
      try {
        // Log user profile for debugging (remove in production)
        console.log('Auth user profile:', auth.user.profile);
        
        // Check for 'cognito:groups' claim which contains user's groups
        const userGroups = auth.user.profile?.['cognito:groups'] || [];
        
        if (Array.isArray(userGroups)) {
          // Check if user is in the administrators group
          if (userGroups.includes('administrators')) {
            setIsAdmin(true);
            return;
          }
        } else if (typeof userGroups === 'string') {
          // Sometimes groups might be delivered as a comma-separated string
          const groupsArray = userGroups.split(',');
          if (groupsArray.includes('administrators')) {
            setIsAdmin(true);
            return;
          }
        }
        
        // Fallback to server-side check if group information isn't available in token
        const userId = getUserId(auth.user);
        const isDev = process.env.NODE_ENV === 'development';
        const response = await fetch(`${API_BASE_URL}/research/check-admin/${userId}${isDev ? '?testAdmin=true' : ''}`);
        
        if (!response.ok) {
          if (response.status === 403) {
            setIsAdmin(false);
            return;
          }
          throw new Error('Failed to check admin status');
        }
        
        const data = await response.json();
        setIsAdmin(data.isAdmin);
      } catch (error) {
        console.error('Error checking admin status:', error);
        // For development, you can uncomment the line below for testing
        // setIsAdmin(true);
        setIsAdmin(false);
      }
    };
    
    checkAdminStatus();
  }, [auth.isAuthenticated, auth.user]);

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
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen);
    } else {
      setCollapsed(!collapsed);
    }
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
        styles={{ body: { padding: '24px' } }}
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

      {/* Mobile Menu Drawer - only shown on mobile */}
      <Drawer
        title="X10e Menu"
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={isMobile && mobileMenuOpen}
        className="mobile-menu-drawer"
        width={250}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="inline"
          defaultSelectedKeys={['dashboard']}
          style={{ height: '100%', borderRight: 0 }}
          items={[
            {
              key: 'dashboard',
              icon: <DashboardOutlined />,
              label: 'Dashboard',
              onClick: () => {
                setMobileMenuOpen(false);
                setChatExpanded(false);
                setActiveSection('dashboard');
              }
            },
            {
              key: 'new-chat',
              icon: <PlusOutlined />,
              label: 'New Chat',
              onClick: () => {
                startNewChat();
                setMobileMenuOpen(false);
              }
            },
            {
              key: 'chat-history',
              icon: <HistoryOutlined />,
              label: 'Chat History'
            },
            {
              key: 'profile',
              icon: <UserOutlined />,
              label: 'Health Profile',
              onClick: () => {
                setShowProfileForm(true);
                setMobileMenuOpen(false);
              }
            },
            ...(isAdmin ? [
              {
                key: 'research',
                icon: <FileTextOutlined />,
                label: 'Manage LLM Data',
                onClick: () => {
                  setMobileMenuOpen(false);
                  setChatExpanded(false);
                  setActiveSection('research');
                }
              }
            ] : []),
            {
              key: 'settings',
              icon: <SettingOutlined />,
              label: 'Settings'
            },
            {
              key: 'logout',
              icon: <LoginOutlined />,
              label: 'Logout',
              onClick: () => signOutRedirect()
            }
          ]}
        />
        
        {/* Chat history in mobile menu */}
        {auth.isAuthenticated && (
          <div style={{ padding: '0 16px 16px 16px' }}>
            <Divider orientation="left" style={{ fontSize: '14px', margin: '8px 0 16px 0' }}>
              Recent Chats
            </Divider>
            
            {loadingChatSessions ? (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <Spin size="small" />
              </div>
            ) : chatSessions.length === 0 ? (
              <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
                description="No chat history yet" 
                style={{ margin: '16px 0' }}
              />
            ) : (
              <List
                size="small"
                dataSource={chatSessions.slice(0, 5)} // Limit to 5 most recent
                renderItem={(item) => (
                  <List.Item
                    style={{ 
                      padding: '8px 0',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                    onClick={() => {
                      loadChatSession(item.sessionId);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<MessageOutlined />} size="small" />}
                      title={
                        <div style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        )}
      </Drawer>

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
          {auth.isAuthenticated && !isMobile && (
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
            <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column' }} className="user-info-text">
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
        {/* Only show Sider on desktop */}
        {!isMobile && (
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
                <div style={{ margin: '16px 0 8px 0' }}>
                  <Button
                    type={activeSection === 'dashboard' ? 'default' : 'text'}
                    block
                    icon={<DashboardOutlined />}
                    onClick={() => {
                      setActiveSection('dashboard');
                      setChatExpanded(false);
                    }}
                    style={{ textAlign: 'left', marginBottom: '8px' }}
                  >
                    Dashboard
                  </Button>
                  
                  {isAdmin && (
                    <Button
                      type={activeSection === 'research' ? 'default' : 'text'}
                      block
                      icon={<FileTextOutlined />}
                      onClick={() => {
                        setActiveSection('research');
                        setChatExpanded(false);
                      }}
                      style={{ textAlign: 'left', marginBottom: '8px' }}
                    >
                      Manage LLM Data
                    </Button>
                  )}
                </div>
              )}
              
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
        )}

        <Content style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          height: '100%',
          overflow: 'hidden',
          ...blurStyle
        }}>
          {/* Conditional rendering based on activeSection */}
          {activeSection === 'dashboard' && (
            <HealthDashboard 
              userId={auth.user ? getUserId(auth.user) : null}
              isVisible={!chatExpanded}
            />
          )}
          
          {/* Research Papers Section - Only visible to admins */}
          {activeSection === 'research' && isAdmin && (
            <ResearchPapers 
              userId={auth.user ? getUserId(auth.user) : null}
              isVisible={!chatExpanded}
            />
          )}
          
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