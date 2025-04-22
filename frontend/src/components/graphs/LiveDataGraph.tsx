import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import axios from 'axios';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend
} from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  LineElement, 
  PointElement, 
  LinearScale, 
  TimeScale,
  Title, 
  CategoryScale, 
  Tooltip, 
  Legend
);

interface LiveDataGraphProps {
  biomarker: string;
  label: string;
  color?: string;
  refreshInterval?: number;
  showPoints?: boolean;
  maxDataPoints?: number;
}

interface DataPoint {
  timestamp: string;
  value: number;
}

const LiveDataGraph: React.FC<LiveDataGraphProps> = ({
  biomarker,
  label,
  color = 'rgba(75,192,192,1)',
  refreshInterval = 1000,
  showPoints = true,
  maxDataPoints = 100
}) => {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const intervalRef = useRef<number | null>(null);
  const streamStartTime = useRef<Date>(new Date());

  // Extract primary biomarker field from API naming
  const getBiomarkerField = (name: string): string => {
    const mapping: {[key: string]: string} = {
      'cortisol': 'cortisol_base',
      'lactate': 'lactate_base',
      'uric_acid': 'uric_acid_base',
      'crp': 'crp_base',
      'il6': 'il6_base',
      'body_temp': 'body_temp_base',
      'heart_rate': 'heart_rate_base',
      'blood_oxygen': 'blood_oxygen_base'
    };
    return mapping[name] || name;
  };
  
  const fetchLatestData = async () => {
    try {
      // Get current time and time 10 seconds ago for recent data
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - 10000).toISOString();
      
      const field = getBiomarkerField(biomarker);
      const response = await axios.get(`http://localhost:3000/biomarker/${field}`, {
        params: { startTime, endTime }
      });
      
      if (response.data && response.data.data) {
        // Process new data points
        const newPoints = response.data.data.map((item: any) => ({
          timestamp: item.timestamp,
          value: item[field]
        }));
        
        // Update state by merging existing and new points
        setDataPoints(prevPoints => {
          // Combine existing and new points
          const combinedPoints = [...prevPoints, ...newPoints];
          
          // Remove duplicates based on timestamp
          const uniquePoints = combinedPoints.filter((point, index, self) =>
            index === self.findIndex(p => p.timestamp === point.timestamp)
          );
          
          // Sort by timestamp
          const sortedPoints = uniquePoints.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          
          // Limit the number of data points to prevent performance issues
          return sortedPoints.slice(-maxDataPoints);
        });
      }
    } catch (error) {
      console.error('Error fetching biomarker data:', error);
    }
  };

  // WebSocket connection setup
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initial data fetch
    fetchLatestData();
    
    // Set up WebSocket connection
    const wsUrl = `ws://${window.location.hostname}:3000`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log(`WebSocket connected for ${biomarker} data`);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const field = getBiomarkerField(biomarker);
        
        if (data && data[field] !== undefined) {
          const newPoint: DataPoint = {
            timestamp: data.timestamp || new Date().toISOString(),
            value: data[field]
          };
          
          setDataPoints(prevPoints => {
            // Add new point
            const combinedPoints = [...prevPoints, newPoint];
            
            // Remove duplicates by timestamp
            const uniquePoints = combinedPoints.filter((point, index, self) =>
              index === self.findIndex(p => p.timestamp === point.timestamp)
            );
            
            // Sort by timestamp
            const sortedPoints = uniquePoints.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            
            // Limit to maxDataPoints
            return sortedPoints.slice(-maxDataPoints);
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket data:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error(`WebSocket error for ${biomarker}:`, error);
      // Fall back to polling if WebSocket fails
      if (!intervalRef.current) {
        intervalRef.current = window.setInterval(fetchLatestData, refreshInterval);
      }
    };
    
    ws.onclose = () => {
      console.log(`WebSocket connection closed for ${biomarker}`);
      // Fall back to polling if WebSocket closes
      if (!intervalRef.current) {
        intervalRef.current = window.setInterval(fetchLatestData, refreshInterval);
      }
    };
    
    // Also set up periodic data fetching as a fallback
    intervalRef.current = window.setInterval(fetchLatestData, refreshInterval);
    
    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [biomarker, refreshInterval]);

  // Prepare chart data
  const chartData = {
    datasets: [
      {
        label: label,
        data: dataPoints.map(point => ({
          x: new Date(point.timestamp),
          y: point.value
        })),
        fill: false,
        borderColor: color,
        backgroundColor: color.replace('1)', '0.2)'),
        borderWidth: 2,
        tension: 0.3,
        pointRadius: showPoints ? 3 : 0,
        pointHoverRadius: 5,
        pointBackgroundColor: 'white',
        pointBorderColor: color,
        pointBorderWidth: 2
      }
    ]
  };

  // Chart options
  const chartOptions = {
    maintainAspectRatio: false,
    responsive: true,
    animation: {
      duration: 250
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: 'second' as const,
          displayFormats: {
            second: 'HH:mm:ss'
          }
        },
        title: {
          display: true,
          text: 'Time'
        }
      },
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: label
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        callbacks: {
          title: (context: any) => {
            const date = new Date(context[0].parsed.x);
            return date.toLocaleTimeString();
          }
        }
      }
    }
  };

  return (
    <div style={{ 
      width: '100%', 
      height: '300px', 
      margin: '0 auto',
      overflow: 'hidden',
      border: '1px solid #eee',
      borderRadius: '8px',
      padding: '10px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>{label}</h3>
      {dataPoints.length === 0 ? (
        <div style={{ display: 'flex', height: '80%', alignItems: 'center', justifyContent: 'center' }}>
          Loading data...
        </div>
      ) : (
        <Line data={chartData} options={chartOptions} />
      )}
      <div style={{ textAlign: 'center', fontSize: '12px', color: '#666', marginTop: '5px' }}>
        Monitoring since {streamStartTime.current.toLocaleTimeString()} • {dataPoints.length} data points
      </div>
    </div>
  );
};

export default LiveDataGraph;