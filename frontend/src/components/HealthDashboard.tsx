import React, { useState, useEffect } from 'react';
import { 
  Typography, Row, Col, Card, Skeleton, Tabs, Divider, 
  Button, Statistic, Badge, Space, Tooltip as AntTooltip
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
  BarChartOutlined
} from '@ant-design/icons';

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

// Function to analyze health data and provide a summary
const analyzeHealthData = (healthData: HealthData | null): string => {
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
  
  // Generate overall health status message
  if (concernIndicators.length === 0 && positiveIndicators.length > 1) {
    return `Your health metrics look excellent! Your ${positiveIndicators.join(' and ')} are in optimal ranges.`;
  } else if (concernIndicators.length === 1) {
    return `Your health is generally good, though your ${concernIndicators[0]} levels may need attention.`;
  } else if (concernIndicators.length > 1) {
    return `Some biomarkers including ${concernIndicators.join(' and ')} show trends that may require monitoring.`;
  } else {
    return "Your health metrics are within normal ranges based on recent readings.";
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

// Get trend icon for biomarker
const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'increasing':
      return <ArrowUpOutlined style={{ color: '#ff4d4f' }} />;
    case 'decreasing':
      return <ArrowDownOutlined style={{ color: '#52c41a' }} />;
    case 'stable':
      return <MinusOutlined style={{ color: '#1890ff' }} />;
    default:
      return null;
  }
};

const HealthDashboard: React.FC<HealthDashboardProps> = ({ userId, isVisible }) => {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisText, setAnalysisText] = useState<string>("");
  const [showGraphs, setShowGraphs] = useState(false);
  
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

  // Generate analysis when health data changes
  useEffect(() => {
    if (healthData) {
      const analysis = analyzeHealthData(healthData);
      setAnalysisText(analysis);
    }
  }, [healthData]);

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

  // Render the welcome summary view
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
                    {analysisText}
                  </Text>
                  <div style={{ marginTop: '16px', textAlign: 'right' }}>
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
                <Card>
                  <Skeleton active paragraph={{ rows: 1 }} />
                </Card>
              </Col>
            ))
          ) : (
            <>
              {['heart_rate_base', 'body_temp_base', 'blood_oxygen_base'].map((biomarker) => {
                const value = healthData?.averages[biomarker as keyof BiomarkerAverages] || 0;
                const trend = healthData?.trends[biomarker as keyof BiomarkerTrends] || '';
                const name = BIOMARKER_NAMES[biomarker as keyof typeof BIOMARKER_NAMES];
                const unit = BIOMARKER_UNITS[biomarker as keyof typeof BIOMARKER_UNITS];
                const color = getBiomarkerStatusColor(value, biomarker);
                
                return (
                  <Col xs={24} sm={8} key={biomarker}>
                    <Card>
                      <Statistic
                        title={
                          <Space>
                            <Badge status={color as any} />
                            <span>{name}</span>
                          </Space>
                        }
                        value={value.toFixed(1)}
                        suffix={
                          <Space>
                            <span>{unit}</span>
                            {getTrendIcon(trend)}
                          </Space>
                        }
                        precision={1}
                      />
                    </Card>
                  </Col>
                );
              })}
            </>
          )}
        </Row>

        <Divider orientation="left">Biomarkers</Divider>
        <Row gutter={[16, 16]}>
          {loading ? (
            Array(5).fill(null).map((_, index) => (
              <Col xs={24} sm={12} md={8} lg={6} xl={4} key={index}>
                <Card>
                  <Skeleton active paragraph={{ rows: 1 }} />
                </Card>
              </Col>
            ))
          ) : (
            <>
              {['cortisol_base', 'lactate_base', 'uric_acid_base', 'crp_base', 'il6_base'].map((biomarker) => {
                const value = healthData?.averages[biomarker as keyof BiomarkerAverages] || 0;
                const trend = healthData?.trends[biomarker as keyof BiomarkerTrends] || '';
                const name = BIOMARKER_NAMES[biomarker as keyof typeof BIOMARKER_NAMES];
                const unit = BIOMARKER_UNITS[biomarker as keyof typeof BIOMARKER_UNITS];
                const color = getBiomarkerStatusColor(value, biomarker);
                
                return (
                  <Col xs={24} sm={12} md={8} lg={6} xl={4} key={biomarker}>
                    <Card>
                      <Statistic
                        title={
                          <Space>
                            <Badge status={color as any} />
                            <span>{name}</span>
                          </Space>
                        }
                        value={value.toFixed(1)}
                        suffix={
                          <Space>
                            <span>{unit}</span>
                            {getTrendIcon(trend)}
                          </Space>
                        }
                        precision={1}
                      />
                    </Card>
                  </Col>
                );
              })}
            </>
          )}
        </Row>
      </div>
    );
  };

  // Render the detailed graphs view
  const renderGraphsView = () => {
    return (
      <div>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4}>Health Analytics</Title>
          <Button onClick={() => setShowGraphs(false)}>
            Back to Summary
          </Button>
        </div>
        
        <Tabs defaultActiveKey="1">
          <TabPane tab="Vital Signs" key="1">
            <Card bordered={false}>
              {loading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={prepareVitalSignsData()}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" domain={[90, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="heartRate"
                      name="Heart Rate (BPM)"
                      stroke={COLORS.heart_rate}
                      activeDot={{ r: 8 }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="bodyTemp"
                      name="Body Temperature (°C)"
                      stroke={COLORS.body_temp}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="bloodOxygen"
                      name="Blood Oxygen (%)"
                      stroke={COLORS.blood_oxygen}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
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

  return (
    <div 
      style={{
        padding: '20px',
        paddingBottom: '170px', // Ensure bottom graph isn't covered by chat panel
        height: '100%', 
        overflowY: 'auto',
        transition: 'opacity 0.3s ease-in-out',
        opacity: isVisible ? 1 : 0
      }}
    >
      {showGraphs ? renderGraphsView() : renderSummaryView()}
    </div>
  );
};

export default HealthDashboard;