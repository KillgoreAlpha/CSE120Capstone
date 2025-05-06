import React, { useState, useEffect, useRef } from 'react';
import { PrinterOutlined } from '@ant-design/icons';
import Datapdf from './Datapdf';
import { 
  Typography, Row, Col, Card, Skeleton, Tabs, Divider, 
  Button, Statistic, Badge, Space, Tooltip as AntTooltip, Modal, Spin
} from 'antd';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Cell 
} from 'recharts';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  BarChartOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  HeartOutlined,
  ExperimentOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { useUserHealthProfile } from '../hooks/useUserHealthProfile';

const { Text, Title } = Typography;
const { TabPane } = Tabs;

// Define interfaces for health data
interface BiomarkerReading {
  id: number;
  cortisol_base: number;
  lactate_base: number;
  uric_acid_base: number;
  crp_base: number;
  il6_base: number;
  body_temp_base: number;
  heart_rate_base: number;
  blood_oxygen_base: number;
  timestamp: string;
}

interface BiomarkerAverages {
  cortisol_base?: number;
  lactate_base?: number;
  uric_acid_base?: number;
  crp_base?: number;
  il6_base?: number;
  body_temp_base?: number;
  heart_rate_base?: number;
  blood_oxygen_base?: number;
}

interface BiomarkerTrends {
  cortisol_base?: string;
  lactate_base?: string;
  uric_acid_base?: string;
  crp_base?: string;
  il6_base?: string;
  body_temp_base?: string;
  heart_rate_base?: string;
  blood_oxygen_base?: string;
}

interface HealthData {
  readings: BiomarkerReading[];
  averages: BiomarkerAverages;
  trends: BiomarkerTrends;
  readingCount: number;
  startDate: string;
  endDate: string;
}

interface HealthDashboardProps {
  userId: string | null;
  isVisible: boolean;
}

// Color configuration for different biomarkers
const COLORS = {
  cortisol: '#8884d8',
  lactate: '#82ca9d',
  uric_acid: '#ffc658',
  crp: '#ff8042',
  il6: '#0088FE',
  body_temp: '#00C49F',
  heart_rate: '#FF8042',
  blood_oxygen: '#FFBB28'
};

const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

// Normal ranges for biomarkers
const NORMAL_RANGES = {
  cortisol_base: { min: 138, max: 635 },
  lactate_base: { min: 0.5, max: 2.0 },
  uric_acid_base: { min: 3.0, max: 7.0 },
  crp_base: { min: 0, max: 8.0 },
  il6_base: { min: 0, max: 14.0 },
  body_temp_base: { min: 36.5, max: 37.5 },
  heart_rate_base: { min: 60, max: 100 },
  blood_oxygen_base: { min: 95, max: 100 }
};

// Biomarker display names
const BIOMARKER_NAMES = {
  cortisol_base: "Cortisol",
  lactate_base: "Lactate",
  uric_acid_base: "Uric Acid",
  crp_base: "CRP",
  il6_base: "IL-6",
  body_temp_base: "Body Temp",
  heart_rate_base: "Heart Rate",
  blood_oxygen_base: "Blood Oxygen"
};

// Biomarker units
const BIOMARKER_UNITS = {
  cortisol_base: "nmol/L",
  lactate_base: "mmol/L",
  uric_acid_base: "mg/dL",
  crp_base: "mg/L",
  il6_base: "pg/mL",
  body_temp_base: "°C",
  heart_rate_base: "BPM",
  blood_oxygen_base: "%"
};

// Function to analyze health data and provide a summary based on user profile
const analyzeHealthData = (healthData: HealthData | null, profileData: any): string => {
  if (!healthData) return "Loading your health information...";

  // Create a summary based on trends
  const trends = healthData.trends;
  const positiveIndicators = [];
  const concernIndicators = [];

  // Check trends for each biomarker
  if (trends.heart_rate_base === 'stable') positiveIndicators.push('heart rate');
  if (trends.body_temp_base === 'stable') positiveIndicators.push('body temperature');
  if (trends.blood_oxygen_base === 'stable' || trends.blood_oxygen_base === 'increasing') 
    positiveIndicators.push('blood oxygen');

  if (trends.cortisol_base === 'increasing') concernIndicators.push('cortisol');
  if (trends.lactate_base === 'increasing') concernIndicators.push('lactate');
  if (trends.crp_base === 'increasing') concernIndicators.push('CRP');
  if (trends.il6_base === 'increasing') concernIndicators.push('IL-6');

  // Check user age to personalize message
  const userAge = profileData?.age || 30; // Default to 30 if not available
  let ageContext = "";
  
  if (userAge < 25) {
    ageContext = "At your age, your body typically recovers well and adapts quickly to changes.";
  } else if (userAge >= 25 && userAge < 40) {
    ageContext = "For someone in your age group, these readings are important indicators of your overall wellness.";
  } else if (userAge >= 40 && userAge < 60) {
    ageContext = "As we reach middle age, keeping these biomarkers stable becomes increasingly important for long-term health.";
  } else {
    ageContext = "At your age, consistent monitoring of these biomarkers helps maintain your quality of life and independence.";
  }

  // Generate overall health status message
  if (concernIndicators.length === 0 && positiveIndicators.length > 1) {
    return `Your health metrics look excellent! Your ${positiveIndicators.join(' and ')} are in optimal ranges. ${ageContext}`;
  } else if (concernIndicators.length === 1) {
    return `Your health is generally good, though your ${concernIndicators[0]} levels may need attention. ${ageContext}`;
  } else if (concernIndicators.length > 1) {
    return `Some biomarkers including ${concernIndicators.join(' and ')} show trends that may require monitoring. ${ageContext}`;
  } else {
    return `Your health metrics are within normal ranges based on recent readings. ${ageContext}`;
  }
};

// Get status color for biomarker
const getBiomarkerStatusColor = (value: number, biomarker: string) => {
  const range = NORMAL_RANGES[biomarker as keyof typeof NORMAL_RANGES];
  if (!range) return "default";

  if (value < range.min) return "blue";
  if (value > range.max) return "red";
  return "green";
};

// Get trend icon and text for biomarker
const getTrendInfo = (trend: string, biomarker: string) => {
  // Determine if increasing/decreasing is good or bad based on biomarker type
  const isIncreasingGood = ['blood_oxygen_base'].includes(biomarker);
  const isDecreasingGood = ['cortisol_base', 'lactate_base', 'uric_acid_base', 'crp_base', 'il6_base'].includes(biomarker);
  
  switch (trend) {
    case 'increasing':
      return {
        icon: <ArrowUpOutlined style={{ color: isIncreasingGood ? '#52c41a' : '#ff4d4f' }} />,
        color: isIncreasingGood ? '#52c41a' : '#ff4d4f',
        text: isIncreasingGood ? 'Improving' : 'Increasing'
      };
    case 'decreasing':
      return {
        icon: <ArrowDownOutlined style={{ color: isDecreasingGood ? '#52c41a' : '#ff4d4f' }} />,
        color: isDecreasingGood ? '#52c41a' : '#ff4d4f',
        text: isDecreasingGood ? 'Improving' : 'Decreasing'
      };
    case 'stable':
      return {
        icon: <MinusOutlined style={{ color: '#1890ff' }} />,
        color: '#1890ff',
        text: 'Stable'
      };
    default:
      return {
        icon: null,
        color: '#999',
        text: 'Unknown'
      };
  }
};

const HealthDashboard: React.FC<HealthDashboardProps> = ({ userId, isVisible }) => {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisText, setAnalysisText] = useState<string>("");
  const [showGraphs, setShowGraphs] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'welcome' | 'vitals' | 'biomarkers' | 'charts'>('welcome');
  const datapdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch health data from the API
    const fetchHealthData = async () => {
      setLoading(true);
      try {
        // Fetch readings from the backend API
        const response = await fetch('http://localhost:3000/readings');
        const data = await response.json();

        if (data && data.readings && data.readings.length > 0) {
          // Sort readings by timestamp (newest to oldest)
          const sortedReadings = [...data.readings].sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

          // Limit to the last 50 readings to ensure we have multiple datapoints per hour
          const recentReadings = sortedReadings.slice(0, 50);

          // Calculate averages for each biomarker
          const biomarkers = [
            'cortisol_base', 'lactate_base', 'uric_acid_base', 'crp_base', 
            'il6_base', 'body_temp_base', 'heart_rate_base', 'blood_oxygen_base'
          ];

          const averages: Record<string, number> = {};
          const trends: Record<string, string> = {};

          biomarkers.forEach(biomarker => {
            const values = recentReadings
              .map(reading => reading[biomarker])
              .filter(val => val !== null && val !== undefined);

            if (values.length > 0) {
              // Calculate average
              const sum = values.reduce((acc, val) => acc + val, 0);
              averages[biomarker] = sum / values.length;

              // Determine trend based on first half vs second half
              if (values.length >= 4) {
                const midpoint = Math.floor(values.length / 2);
                const firstHalf = values.slice(0, midpoint); // More recent values
                const secondHalf = values.slice(midpoint); // Older values

                const firstHalfAvg = firstHalf.reduce((acc, val) => acc + val, 0) / firstHalf.length;
                const secondHalfAvg = secondHalf.reduce((acc, val) => acc + val, 0) / secondHalf.length;

                const percentChange = ((firstHalfAvg - secondHalfAvg) / secondHalfAvg) * 100;

                if (percentChange > 5) {
                  trends[biomarker] = "increasing";
                } else if (percentChange < -5) {
                  trends[biomarker] = "decreasing";
                } else {
                  trends[biomarker] = "stable";
                }
              } else {
                trends[biomarker] = "insufficient data";
              }
            }
          });

          setHealthData({
            readings: recentReadings,
            averages,
            trends,
            readingCount: recentReadings.length,
            startDate: recentReadings[recentReadings.length - 1].timestamp,
            endDate: recentReadings[0].timestamp
          });
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching health data:', error);
        setLoading(false);
      }
    };

    if (userId && isVisible) {
      fetchHealthData();
    }
  }, [userId, isVisible]);

  // Get user health profile
  const { profileData } = useUserHealthProfile(userId);

  // Generate analysis when health data changes
  useEffect(() => {
    if (healthData) {
      const analysis = analyzeHealthData(healthData, profileData);
      setAnalysisText(analysis);
    }
  }, [healthData, profileData]);

  // Prepare data for the vital signs chart
  const prepareVitalSignsData = () => {
    if (!healthData || !healthData.readings || healthData.readings.length === 0) return [];

    // Sort readings by timestamp to ensure chronological order
    const sortedReadings = [...healthData.readings]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Map readings to chart data format
    return sortedReadings.map(reading => ({
      name: new Date(reading.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      heartRate: reading.heart_rate_base,
      bodyTemp: reading.body_temp_base,
      bloodOxygen: reading.blood_oxygen_base
    }));
  };

  // Prepare data for the biomarkers chart
  const prepareBiomarkersData = () => {
    if (!healthData || !healthData.readings || healthData.readings.length === 0) return [];

    // Sort readings by timestamp to ensure chronological order
    const sortedReadings = [...healthData.readings]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Map readings to chart data format
    return sortedReadings.map(reading => ({
      name: new Date(reading.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      cortisol: reading.cortisol_base,
      lactate: reading.lactate_base,
      uricAcid: reading.uric_acid_base,
      crp: reading.crp_base,
      il6: reading.il6_base
    }));
  };

  // Prepare data for the trends pie chart
  const prepareTrendsData = () => {
    if (!healthData || !healthData.trends) return [];

    const trendsCount = {
      stable: 0,
      increasing: 0,
      decreasing: 0,
      insufficient: 0
    };

    Object.entries(healthData.trends).forEach(([, trend]) => {
      if (trend === 'stable') trendsCount.stable++;
      else if (trend === 'increasing') trendsCount.increasing++;
      else if (trend === 'decreasing') trendsCount.decreasing++;
      else trendsCount.insufficient++;
    });

    return [
      { name: 'Stable', value: trendsCount.stable },
      { name: 'Increasing', value: trendsCount.increasing },
      { name: 'Decreasing', value: trendsCount.decreasing },
      { name: 'Insufficient Data', value: trendsCount.insufficient }
    ].filter(item => item.value > 0);
  };

  // Don't render if not visible
  if (!isVisible) return null;


  // Render the detailed biomarker card
  const renderDetailedBiomarkerCard = () => {
    if (!expandedCard || !healthData) return null;
    
    const biomarker = expandedCard;
    const value = healthData.averages[biomarker as keyof BiomarkerAverages] || 0;
    const trend = healthData.trends[biomarker as keyof BiomarkerTrends] || '';
    const name = BIOMARKER_NAMES[biomarker as keyof typeof BIOMARKER_NAMES];
    const unit = BIOMARKER_UNITS[biomarker as keyof typeof BIOMARKER_UNITS];
    const range = NORMAL_RANGES[biomarker as keyof typeof NORMAL_RANGES];
    const trendInfo = getTrendInfo(trend, biomarker);
    
    // Get historical data for chart
    const chartData = healthData.readings
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(reading => ({
        time: new Date(reading.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        value: reading[biomarker as keyof BiomarkerReading]
      }));
      
    return (
      <Modal
        title={<Title level={4}>{name} Details</Title>}
        open={!!expandedCard}
        onCancel={() => setExpandedCard(null)}
        footer={null}
        width={700}
      >
        <div style={{ marginBottom: 20 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Card>
                <Statistic 
                  title="Current Value"
                  value={value.toFixed(1)}
                  suffix={unit}
                  precision={1}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card>
                <Statistic 
                  title="Normal Range"
                  value={`${range.min} - ${range.max}`}
                  suffix={unit}
                />
              </Card>
            </Col>
          </Row>
        </div>
        
        <div style={{ marginBottom: 20 }}>
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Trend Analysis:</Text>
              <p style={{ color: trendInfo.color }}>
                Your {name.toLowerCase()} is currently <b>{trendInfo.text.toLowerCase()}</b>. 
                {value < range.min 
                  ? ` This is below the normal range, which may indicate an issue.`
                  : value > range.max 
                    ? ` This is above the normal range, which may require attention.`
                    : ` This is within the normal range, which is good.`
                }
              </p>
            </div>
          </Card>
        </div>
        
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </Modal>
    );
  };

  // Render a single biomarker card
  const renderBiomarkerCard = (biomarker: string) => {
    const value = healthData?.averages[biomarker as keyof BiomarkerAverages] || 0;
    const trend = healthData?.trends[biomarker as keyof BiomarkerTrends] || '';
    const name = BIOMARKER_NAMES[biomarker as keyof typeof BIOMARKER_NAMES];
    const unit = BIOMARKER_UNITS[biomarker as keyof typeof BIOMARKER_UNITS];
    const color = getBiomarkerStatusColor(value, biomarker);
    const trendInfo = getTrendInfo(trend, biomarker);
    const range = NORMAL_RANGES[biomarker as keyof typeof NORMAL_RANGES];

    // Generate a user-friendly message about the biomarker
    const getMessage = () => {
      if (value < range.min) {
        return `Your ${name.toLowerCase()} is below normal range`;
      } else if (value > range.max) {
        return `Your ${name.toLowerCase()} is above normal range`;
      } else {
        return `Your ${name.toLowerCase()} is within normal range`;
      }
    };

    return (
      <Card 
        hoverable
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        onClick={() => setExpandedCard(biomarker)}
      >
        <div style={{ marginBottom: 8 }}>
          <Space>
            <Badge status={color as any} />
            <Text strong style={{ fontSize: '16px' }}>{name}</Text>
            {trendInfo.icon}
          </Space>
        </div>
        
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            {getMessage()}
          </Text>
        </div>
        
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Text>{value.toFixed(1)} {unit}</Text>
          <Button 
            size="small" 
            type="text" 
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              setExpandedCard(biomarker);
            }}
          >
            Details
          </Button>
        </div>
      </Card>
    );
  };

  // Create linked text for biomarkers in summary
  const createLinkedSummaryText = (text: string) => {
    if (!text) return null;
    
    // List of all biomarkers to look for in text
    const biomarkers = [
      { key: 'cortisol_base', name: 'cortisol' },
      { key: 'lactate_base', name: 'lactate' },
      { key: 'uric_acid_base', name: 'uric acid' },
      { key: 'crp_base', name: 'CRP' },
      { key: 'il6_base', name: 'IL-6' },
      { key: 'body_temp_base', name: 'body temperature' },
      { key: 'heart_rate_base', name: 'heart rate' },
      { key: 'blood_oxygen_base', name: 'blood oxygen' }
    ];
    
    let parts: (string | JSX.Element)[] = [text];
    
    // For each biomarker, check if it exists in any text part and split accordingly
    biomarkers.forEach(biomarker => {
      parts = parts.flatMap(part => {
        // Only process string parts, leave JSX elements untouched
        if (typeof part !== 'string') return part;
        
        const lowerPart = part.toLowerCase();
        const lowerName = biomarker.name.toLowerCase();
        
        // Find the biomarker in the text (case insensitive)
        const index = lowerPart.indexOf(lowerName);
        if (index === -1) return part;
        
        // Extract the actual text as it appears in the original string
        const actualText = part.substring(index, index + biomarker.name.length);
        
        // Split the text into parts: before, biomarker (as JSX), and after
        return [
          part.substring(0, index),
          <Text key={biomarker.key} 
                style={{ color: '#1890ff', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={(e) => {
                  e.preventDefault(); // Prevent any default handling
                  e.stopPropagation(); // Stop event bubbling
                  setExpandedCard(biomarker.key);
                }}>
            {actualText}
          </Text>,
          part.substring(index + biomarker.name.length)
        ];
      });
    });
    
    return parts;
  };

  // Render welcome view with action buttons
  const renderWelcomeView = () => {
    const firstName = profileData?.givenName || 'there';
    
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <div style={{ marginBottom: '30px' }}>
          <Title level={1}>Welcome back!</Title>
          <Text style={{ fontSize: '16px', color: '#666', display: 'block', marginTop: '16px' }}>
            What would you like to dive into today?
          </Text>
        </div>
        
        <Row justify="center" gutter={[16, 16]} className="welcome-cards" style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <Col xs={24} sm={12} lg={8}>
            <Card 
              hoverable 
              style={{ textAlign: 'center', height: '200px' }}
              onClick={() => setActiveView('vitals')}
            >
              <div style={{ fontSize: '40px', color: '#1890ff', marginBottom: '16px' }}>
                <HeartOutlined />
              </div>
              <Title level={4}>View Vitals</Title>
              <Text type="secondary">Check your heart rate, temperature, and oxygen levels</Text>
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={8}>
            <Card 
              hoverable 
              style={{ textAlign: 'center', height: '200px' }}
              onClick={() => setActiveView('biomarkers')}
            >
              <div style={{ fontSize: '40px', color: '#52c41a', marginBottom: '16px' }}>
                <ExperimentOutlined />
              </div>
              <Title level={4}>View Biomarkers</Title>
              <Text type="secondary">Review your key biomarker indicators</Text>
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={8}>
            <Card 
              hoverable 
              style={{ textAlign: 'center', height: '200px' }}
              onClick={() => setActiveView('charts')}
            >
              <div style={{ fontSize: '40px', color: '#722ed1', marginBottom: '16px' }}>
                <LineChartOutlined />
              </div>
              <Title level={4}>View Charts</Title>
              <Text type="secondary">Analyze your health data in detail</Text>
            </Card>
          </Col>
        </Row>
        
        {loading && (
          <div style={{ marginTop: '30px' }}>
            <Spin size="large" />
            <Text style={{ display: 'block', marginTop: '16px' }}>Loading your health data...</Text>
          </div>
        )}
      </div>
    );
  };

  // Render the summary view with all cards
  const renderSummaryView = () => {
    return (
      <div style={{ marginBottom: '24px' }}>
        <Row gutter={[24, 24]}>
          <Col span={24}>
            <Card bordered={false}>
              {loading ? (
                <Skeleton active paragraph={{ rows: 1 }} />
              ) : (
                <div>
                  <Text style={{ fontSize: '16px', color: '#333' }}>
                    {createLinkedSummaryText(analysisText)}
                  </Text>
                  <div style={{ marginTop: '16px', textAlign: 'right' }}>
                    <Button
                      type="default"
                      icon={<PrinterOutlined />}
                      onClick={() => {
                        const event = new CustomEvent('exportPDF');
                        window.dispatchEvent(event);
                      }}
                      style={{ marginRight: '10px' }}
                    >
                      Export to PDF
                    </Button>
                    <Button 
                      type="primary"
                      icon={<BarChartOutlined />}
                      onClick={() => setShowGraphs(true)}
                    >
                      View Detailed Graphs
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </Col>
        </Row>

        <Divider orientation="left">Vital Signs</Divider>
        <Row gutter={[16, 16]}>
          {loading ? (
            Array(3).fill(null).map((_, index) => (
              <Col xs={24} sm={8} key={index}>
                <Card style={{ height: '160px' }}>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              </Col>
            ))
          ) : (
            <>
              {['heart_rate_base', 'body_temp_base', 'blood_oxygen_base'].map((biomarker) => (
                <Col xs={24} sm={8} key={biomarker} style={{ height: '100%' }}>
                  {renderBiomarkerCard(biomarker)}
                </Col>
              ))}
            </>
          )}
        </Row>

        <Divider orientation="left">Biomarkers</Divider>
        <Row gutter={[16, 16]}>
          {loading ? (
            Array(5).fill(null).map((_, index) => (
              <Col xs={24} sm={12} md={8} key={index}>
                <Card style={{ height: '160px' }}>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              </Col>
            ))
          ) : (
            <>
              {['cortisol_base', 'lactate_base', 'uric_acid_base', 'crp_base', 'il6_base'].map((biomarker) => (
                <Col xs={24} sm={12} md={8} key={biomarker} style={{ height: '100%' }}>
                  {renderBiomarkerCard(biomarker)}
                </Col>
              ))}
            </>
          )}
        </Row>
        
        {renderDetailedBiomarkerCard()}
      </div>
    );
  };
  
  // Render just the vital signs section
  const renderVitalsView = () => {
    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title level={2}>Vital Signs</Title>
          <Button onClick={() => setActiveView('welcome')}>Back to Dashboard</Button>
        </div>
        
        <Card bordered={false} style={{ marginBottom: '24px' }}>
          {loading ? (
            <Skeleton active paragraph={{ rows: 1 }} />
          ) : (
            <Text style={{ fontSize: '16px', color: '#333' }}>
              {createLinkedSummaryText(analysisText)}
            </Text>
          )}
        </Card>
        
        <Row gutter={[16, 16]}>
          {loading ? (
            Array(3).fill(null).map((_, index) => (
              <Col xs={24} sm={8} key={index}>
                <Card style={{ height: '160px' }}>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              </Col>
            ))
          ) : (
            <>
              {['heart_rate_base', 'body_temp_base', 'blood_oxygen_base'].map((biomarker) => (
                <Col xs={24} sm={8} key={biomarker} style={{ height: '100%' }}>
                  {renderBiomarkerCard(biomarker)}
                </Col>
              ))}
            </>
          )}
        </Row>
        
        {renderDetailedBiomarkerCard()}
      </div>
    );
  };
  
  // Render just the biomarkers section
  const renderBiomarkersView = () => {
    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title level={2}>Biomarkers</Title>
          <Button onClick={() => setActiveView('welcome')}>Back to Dashboard</Button>
        </div>
        
        <Card bordered={false} style={{ marginBottom: '24px' }}>
          {loading ? (
            <Skeleton active paragraph={{ rows: 1 }} />
          ) : (
            <Text style={{ fontSize: '16px', color: '#333' }}>
              {createLinkedSummaryText(analysisText)}
            </Text>
          )}
        </Card>
        
        <Row gutter={[16, 16]}>
          {loading ? (
            Array(5).fill(null).map((_, index) => (
              <Col xs={24} sm={12} md={8} key={index}>
                <Card style={{ height: '160px' }}>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              </Col>
            ))
          ) : (
            <>
              {['cortisol_base', 'lactate_base', 'uric_acid_base', 'crp_base', 'il6_base'].map((biomarker) => (
                <Col xs={24} sm={12} md={8} key={biomarker} style={{ height: '100%' }}>
                  {renderBiomarkerCard(biomarker)}
                </Col>
              ))}
            </>
          )}
        </Row>
        
        {renderDetailedBiomarkerCard()}
      </div>
    );
  };

  // Render the detailed graphs view has been removed to avoid duplicate declaration

  // Update the GraphsView to include a back button
  const renderGraphsView = () => {
    return (
      <div>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>Health Analytics</Title>
          <Button onClick={() => setActiveView('welcome')}>Back to Dashboard</Button>
        </div>

        <Tabs defaultActiveKey="1">
          <TabPane tab="Vital Signs" key="1">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', paddingBottom: '1rem' }}>
              <Card bordered={false} style={{ minWidth: '300px', flex: '1 1 300px' }}>
                <Text strong>Heart Rate (BPM)</Text>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={prepareVitalSignsData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: 'BPM', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="heartRate" stroke={COLORS.heart_rate} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card bordered={false} style={{ minWidth: '300px', flex: '1 1 300px' }}>
                <Text strong>Body Temperature (°C)</Text>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={prepareVitalSignsData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: '°C', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="bodyTemp" stroke={COLORS.body_temp} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card bordered={false} style={{ minWidth: '300px', flex: '1 1 300px' }}>
                <Text strong>Blood Oxygen (%)</Text>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={prepareVitalSignsData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[90, 100]} label={{ value: '%', angle: -90, position: 'insideLeft' }} tickFormatter={(val) => `${val}%`} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="bloodOxygen" stroke={COLORS.blood_oxygen} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabPane>

          <TabPane tab="Biomarkers" key="2">
            <Card bordered={false}>
              {loading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={prepareBiomarkersData()}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="cortisol"
                      name="Cortisol"
                      stroke={COLORS.cortisol}
                    />
                    <Line
                      type="monotone"
                      dataKey="lactate"
                      name="Lactate"
                      stroke={COLORS.lactate}
                    />
                    <Line
                      type="monotone"
                      dataKey="uricAcid"
                      name="Uric Acid"
                      stroke={COLORS.uric_acid}
                    />
                    <Line
                      type="monotone"
                      dataKey="crp"
                      name="CRP"
                      stroke={COLORS.crp}
                    />
                    <Line
                      type="monotone"
                      dataKey="il6"
                      name="IL-6"
                      stroke={COLORS.il6}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          </TabPane>

          <TabPane tab="Health Trends" key="3">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card title="Biomarker Trends" bordered={false}>
                  {loading ? (
                    <Skeleton active paragraph={{ rows: 4 }} />
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={prepareTrendsData()}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {prepareTrendsData().map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </Col>

              <Col xs={24} md={12}>
                <Card title="Biomarker Averages" bordered={false}>
                  {loading ? (
                    <Skeleton active paragraph={{ rows: 4 }} />
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={[
                          { name: 'Cortisol', value: healthData?.averages.cortisol_base || 0 },
                          { name: 'Lactate', value: healthData?.averages.lactate_base || 0 },
                          { name: 'Uric Acid', value: healthData?.averages.uric_acid_base || 0 },
                          { name: 'CRP', value: healthData?.averages.crp_base || 0 },
                          { name: 'IL-6', value: healthData?.averages.il6_base || 0 }
                        ]}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" name="Average Value">
                          {[
                            <Cell key="cell-0" fill={COLORS.cortisol} />,
                            <Cell key="cell-1" fill={COLORS.lactate} />,
                            <Cell key="cell-2" fill={COLORS.uric_acid} />,
                            <Cell key="cell-3" fill={COLORS.crp} />,
                            <Cell key="cell-4" fill={COLORS.il6} />
                          ]}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      </div>
    );
  };

  // Render the appropriate view based on activeView state
  const renderContent = () => {
    switch (activeView) {
      case 'welcome':
        return renderWelcomeView();
      case 'vitals':
        return renderVitalsView();
      case 'biomarkers':
        return renderBiomarkersView();
      case 'charts':
        return renderGraphsView();
      default:
        return renderWelcomeView();
    }
  };

  return (
    <div 
      className="health-dashboard-container"
      style={{
        padding: '20px',
        paddingBottom: '170px', // Ensure bottom graph isn't covered by chat panel
        height: '100%',
        overflowY: 'auto',
        transition: 'opacity 0.3s ease-in-out',
        opacity: isVisible ? 1 : 0,
        WebkitOverflowScrolling: 'touch' // Enable smooth scrolling on iOS
      }}
    >
      {showGraphs ? renderGraphsView() : renderSummaryView()}
    </div>
  );
};

export default HealthDashboard;