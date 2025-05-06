import React, { useState, useEffect } from 'react';
import { Typography, Table, Card, Space, Button, Tag, Alert, Spin, Modal, Divider } from 'antd';
import { DownloadOutlined, FileTextOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface ResearchPaper {
  title: string;
  url: string;
  date_retrieved: string;
  source: string;
  id: string;
}

interface ResearchPapersProps {
  userId: string | null;
  isVisible: boolean;
}

const ResearchPapers: React.FC<ResearchPapersProps> = ({ userId, isVisible }) => {
  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [consolidatedText, setConsolidatedText] = useState<string>('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!userId) {
        setIsAdmin(false);
        return;
      }

      try {
        const response = await fetch(`http://localhost:3000/check-admin/${userId}`);
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
        setError('Could not verify administrator access');
        // For development, you can hardcode admin status for testing
        // Remove for production
        setIsAdmin(true);
      }
    };

    checkAdminStatus();
  }, [userId]);

  // Fetch research papers and consolidated text
  useEffect(() => {
    const fetchResearchData = async () => {
      if (!isVisible || !isAdmin || !userId) return;
      
      setLoading(true);
      try {
        // Fetch papers with userId for authorization
        const papersResponse = await fetch(`http://localhost:3000/research/papers?userId=${userId}`);
        if (!papersResponse.ok) {
          if (papersResponse.status === 403) {
            setIsAdmin(false);
            throw new Error('Unauthorized access to research papers');
          }
          throw new Error('Failed to fetch research papers');
        }
        
        const papersData = await papersResponse.json();
        const formattedPapers = Object.entries(papersData).map(([id, details]: [string, any]) => ({
          id,
          title: details.title,
          url: details.url,
          date_retrieved: details.date_retrieved,
          source: details.source
        }));
        
        setPapers(formattedPapers);
        
        // Fetch consolidated text with userId for authorization
        const textResponse = await fetch(`http://localhost:3000/research/consolidated?userId=${userId}`);
        if (!textResponse.ok) {
          if (textResponse.status === 403) {
            setIsAdmin(false);
            throw new Error('Unauthorized access to research text');
          }
          throw new Error('Failed to fetch consolidated research text');
        }
        
        const textData = await textResponse.text();
        setConsolidatedText(textData);
        
      } catch (error) {
        console.error('Error fetching research data:', error);
        setError('Failed to load research data. You may not have sufficient permissions.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchResearchData();
  }, [isVisible, isAdmin, userId]);

  if (!isVisible) return null;
  
  if (!isAdmin) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert 
          message="Access Restricted" 
          description="You do not have permissions to access this research data. Please contact an administrator if you believe this is an error."
          type="error" 
          showIcon 
        />
      </div>
    );
  }

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      render: (text: string) => (
        <Tag color={text === 'pubmed' ? 'blue' : 'purple'}>
          {text.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Date Retrieved',
      dataIndex: 'date_retrieved',
      key: 'date_retrieved',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: ResearchPaper) => (
        <Space size="middle">
          <Button 
            type="primary" 
            icon={<DownloadOutlined />} 
            size="small"
            onClick={() => window.open(record.url, '_blank')}
          >
            Download
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="research-papers-container" style={{ padding: '24px' }}>
      <Card>
        <Title level={2}>Biomarker Research Papers</Title>
        <Paragraph>
          This section contains research papers that have been collected for biomarker analysis and LLM training.
          The papers focus on inflammation biomarkers and their relevance to health monitoring.
        </Paragraph>
        
        <div style={{ marginBottom: '24px' }}>
          <Button 
            type="primary" 
            icon={<FileTextOutlined />}
            onClick={() => setDetailVisible(true)}
          >
            View Consolidated Summary
          </Button>
        </div>
        
        {error && (
          <Alert 
            message="Error" 
            description={error} 
            type="error" 
            showIcon 
            style={{ marginBottom: '16px' }}
          />
        )}
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">Loading research papers...</Text>
            </div>
          </div>
        ) : (
          <Table 
            columns={columns} 
            dataSource={papers} 
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>
      
      <Modal
        title={<><FileTextOutlined /> Consolidated Research Summary</>}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        <div style={{ maxHeight: '70vh', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {loading ? (
            <Spin />
          ) : (
            <pre style={{ fontFamily: 'monospace', fontSize: '14px' }}>
              {consolidatedText}
            </pre>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ResearchPapers;