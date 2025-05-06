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
  Legend,
  Filler,
  ScriptableContext
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
  Legend,
  Filler  // Register Filler plugin to support fill property
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
  // Use refs to store data buffer and interval references
  const dataBuffer = useRef<DataPoint[]>([]);
  const lastUpdateTime = useRef<number>(Date.now());
  const bufferIntervalRef = useRef<number | null>(null);
  const allDataPoints = useRef<DataPoint[]>([]); // Keep a reference to all received data points
  
  // Extract primary biomarker field from API naming
  // Now we're using the direct field names from the server
  const getBiomarkerField = (name: string): string => {
    return name; // We're now using the direct field names
  };
  
  // Function to update the chart's time window to show the last 60 seconds
  const updateTimeWindow = useRef<number | null>(null);
  
  // Function to process buffered data and update state less frequently
  const processBuffer = useRef(() => {
    if (dataBuffer.current.length === 0) return;
    if (!isMounted.current) return;
    
    // First, add new data points to our complete history reference
    allDataPoints.current = [...allDataPoints.current, ...dataBuffer.current];
    
    // Remove duplicates from our complete history
    allDataPoints.current = allDataPoints.current.filter((point, index, self) =>
      index === self.findIndex(p => p.timestamp === point.timestamp)
    );
    
    // Sort the complete history by timestamp
    allDataPoints.current.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Get current time window bounds - last 60 seconds
    const now = Date.now();
    const windowStart = now - 60000; // 60 seconds ago
    
    // Filter points within the current time window for display
    const visiblePoints = allDataPoints.current.filter(point => 
      new Date(point.timestamp).getTime() > windowStart
    );
    
    setDataPoints(visiblePoints);
    
    // Clear buffer after processing
    dataBuffer.current = [];
    lastUpdateTime.current = Date.now();
  });
  
  const fetchLatestData = async () => {
    if (!isMounted.current) return;
    
    try {
      console.log(`Polling data for ${biomarker} via HTTP fallback`);
      // Get current time and time 30 seconds ago for recent data (increased window)
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - 30000).toISOString();
      
      // Make sure we're using the correct API endpoint with the biomarker field name
      const response = await axios.get(`http://localhost:3000/biomarker/${biomarker}`, {
        params: { startTime, endTime }
      });
      
      if (!isMounted.current) return;
      
      if (response.data && response.data.data) {
        console.log(`Received ${response.data.data.length} data points for ${biomarker} via HTTP`);
        
        // Process new data points
        const newPoints = response.data.data.map((item: any) => ({
          timestamp: item.timestamp,
          value: item[biomarker]
        }));
        
        // Update state by merging existing and new points
        if (newPoints.length > 0 && isMounted.current) {
          // Add new points to our history
          allDataPoints.current = [...allDataPoints.current, ...newPoints];
          
          // Remove duplicates from our complete history
          allDataPoints.current = allDataPoints.current.filter((point, index, self) =>
            index === self.findIndex(p => p.timestamp === point.timestamp)
          );
          
          // Sort the complete history by timestamp
          allDataPoints.current.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          
          // Get current time window bounds - last 60 seconds
          const now = Date.now();
          const windowStart = now - 60000; // 60 seconds ago
          
          // Filter points within the current time window for display
          const visiblePoints = allDataPoints.current.filter(point => 
            new Date(point.timestamp).getTime() > windowStart
          );
          
          setDataPoints(visiblePoints);
        } else {
          console.log(`No new data points for ${biomarker}`);
        }
      }
    } catch (error) {
      if (!isMounted.current) return;
      console.error(`Error fetching biomarker data for ${biomarker}:`, error);
    }
  };

  // WebSocket connection setup
  const wsRef = useRef<WebSocket | null>(null);
  // Keep track of connection attempts to implement progressive backoff
  const connectionAttempts = useRef<number>(0);
  // Maximum number of active WebSocket connection attempts
  const MAX_CONNECTION_ATTEMPTS = 5;
  // Track if component is mounted
  const isMounted = useRef<boolean>(true);

  useEffect(() => {
    // Set mount status
    isMounted.current = true;
    
    // Initial data fetch
    fetchLatestData();
    
    // Set up WebSocket connection with retry mechanism
    const connectWebSocket = () => {
      // If component is unmounted, don't attempt connection
      if (!isMounted.current) {
        return;
      }
      
      // If we've already attempted too many connections, rely on polling instead
      if (connectionAttempts.current >= MAX_CONNECTION_ATTEMPTS) {
        console.log(`Maximum WebSocket connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached for ${biomarker}, using polling only`);
        if (!intervalRef.current && isMounted.current) {
          intervalRef.current = window.setInterval(fetchLatestData, refreshInterval);
        }
        return;
      }
      
      // Increment connection attempt counter
      connectionAttempts.current += 1;
      
      // Close existing connection if any
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
      
      // Ensure we use the correct WebSocket URL based on the environment
      // For development, hardcode the localhost URL to ensure consistency
      const wsUrl = 'ws://localhost:3000';
      console.log(`Connecting WebSocket to ${wsUrl} for ${biomarker} (attempt ${connectionAttempts.current})`);
      
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        
        ws.onopen = () => {
          if (!isMounted.current) {
            ws.close();
            return;
          }
          
          console.log(`WebSocket connected for ${biomarker} data`);
          // Reset connection attempts counter on successful connection
          connectionAttempts.current = 0;
          
          // Clear polling interval if it exists since we now have WebSocket
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        };
        
        ws.onmessage = (event) => {
          if (!isMounted.current) return;
          
          try {
            const data = JSON.parse(event.data);
            
            // Handle ping/pong messages from server
            if (data.type === 'ping') {
              // Respond with pong to keep connection alive
              ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
              return;
            }
            
            // Handle echo responses
            if (data.type === 'echo') {
              return;
            }
            
            // Process data only if it contains our biomarker
            if (data && data[biomarker] !== undefined) {
              const newPoint: DataPoint = {
                timestamp: data.timestamp || new Date().toISOString(),
                value: data[biomarker]
              };
              
              // Add to buffer instead of immediately updating state
              dataBuffer.current.push(newPoint);
              
              // Process buffer immediately if we have enough points or enough time has passed
              const updateInterval = 1000; // Minimum time between state updates in ms
              if (dataBuffer.current.length >= 5 || (Date.now() - lastUpdateTime.current) > updateInterval) {
                processBuffer.current();
              }
            }
          } catch (error) {
            console.error('Error processing WebSocket data:', error);
          }
        };
        
        ws.onerror = (error) => {
          if (!isMounted.current) return;
          
          console.warn(`WebSocket error for ${biomarker}, falling back to polling`);
          
          // Fall back to polling immediately if WebSocket fails
          if (!intervalRef.current && isMounted.current) {
            console.log(`Setting up fallback polling for ${biomarker}`);
            intervalRef.current = window.setInterval(fetchLatestData, refreshInterval);
          }
        };
        
        ws.onclose = (event) => {
          if (!isMounted.current) return;
          
          console.log(`WebSocket connection closed for ${biomarker}. Code: ${event.code}, Reason: ${event.reason}`);
          
          // Fall back to polling if WebSocket closes
          if (!intervalRef.current && isMounted.current) {
            console.log(`Setting up fallback polling for ${biomarker}`);
            intervalRef.current = window.setInterval(fetchLatestData, refreshInterval);
          }
          
          // Calculate backoff delay based on number of attempts
          const baseDelay = 1000; // Start with 1 second
          const maxDelay = 30000; // Cap at 30 seconds
          const jitter = Math.random() * 1000; // Add random jitter to prevent all connections retrying at once
          const backoffDelay = Math.min(maxDelay, (baseDelay * Math.pow(2, connectionAttempts.current)) + jitter);
          
          if (isMounted.current) {
            console.log(`Will attempt to reconnect WebSocket for ${biomarker} in ${backoffDelay}ms (attempt ${connectionAttempts.current + 1})`);
            setTimeout(connectWebSocket, backoffDelay);
          }
        };
      } catch (e) {
        console.error(`Error creating WebSocket for ${biomarker}:`, e);
        // Ensure polling is active if WebSocket creation fails
        if (!intervalRef.current && isMounted.current) {
          intervalRef.current = window.setInterval(fetchLatestData, refreshInterval);
        }
      }
    };
    
    // Connect to WebSocket - stagger connections to avoid overwhelming the server
    // Use a randomized delay between biomarkers to prevent all connections happening at once
    const connectionDelay = 500 + (Math.random() * 2000);
    setTimeout(connectWebSocket, connectionDelay);
    
    // Set up interval to process buffer - need to use window.setInterval for proper cleanup
    const updateInterval = 1000; // Minimum time between state updates in ms
    bufferIntervalRef.current = window.setInterval(() => {
      if (isMounted.current) {
        processBuffer.current();
      }
    }, updateInterval);
    
    // Set up buffered data fetching as a fallback - only if WebSocket isn't used
    if (!wsRef.current && !intervalRef.current && isMounted.current) {
      intervalRef.current = window.setInterval(fetchLatestData, refreshInterval);
    }
    
    // Set up an interval to refresh the visible time window every second
    // This ensures data points "move" through the visible window correctly
    const timeWindowRefreshInterval = window.setInterval(() => {
      if (isMounted.current && allDataPoints.current.length > 0) {
        // Get current time window bounds - last 60 seconds
        const now = Date.now();
        const windowStart = now - 60000; // 60 seconds ago
        
        // Filter points within the current time window for display
        const visiblePoints = allDataPoints.current.filter(point => 
          new Date(point.timestamp).getTime() > windowStart
        );
        
        setDataPoints(visiblePoints);
      }
    }, 1000); // Update every second
    
    // Save reference for cleanup
    updateTimeWindow.current = timeWindowRefreshInterval;
    
    // Cleanup on unmount - combine all cleanup in one place
    return () => {
      // Mark component as unmounted
      isMounted.current = false;
      
      // Clean up WebSocket
      if (wsRef.current) {
        try {
          wsRef.current.close();
          wsRef.current = null;
        } catch (e) {
          console.error(`Error closing WebSocket for ${biomarker}:`, e);
        }
      }
      
      // Clean up intervals
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      if (updateTimeWindow.current) {
        clearInterval(updateTimeWindow.current);
        updateTimeWindow.current = null;
      }
      
      // Clean up buffer interval
      if (bufferIntervalRef.current) {
        clearInterval(bufferIntervalRef.current);
        bufferIntervalRef.current = null;
      }
    };
  }, [biomarker, refreshInterval]);

  // Prepare chart data - make sure to not modify the original data points
  const chartData = {
    datasets: [
      {
        label: label,
        data: dataPoints.map(point => ({
          x: new Date(point.timestamp),
          y: point.value
        })),
        fill: true,
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

  // Chart options - memoize to prevent unnecessary re-renders
  const chartOptions = React.useMemo(() => ({
    maintainAspectRatio: false,
    responsive: true,
    animation: false, // Disable animation completely for better performance
    transitions: {
      active: {
        animation: {
          duration: 0
        }
      }
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
        },
        // Set static time window range instead of dynamic calculation on every render
        // Using fixed time window to prevent chart.js from auto-scaling and potentially dropping points
        min: function() {
          return new Date(Date.now() - 60000); // Display last 60 seconds
        },
        max: function() {
          return new Date(); // Current time
        },
        // Define adapter options inline instead of using locale
        adapters: {
          date: {
            // Use explicit date/time formats instead of locale
            formats: {
              datetime: 'MMM d, yyyy h:mm:ss a',
              millisecond: 'h:mm:ss.SSS a',
              second: 'h:mm:ss a',
              minute: 'h:mm a',
              hour: 'ha',
              day: 'MMM d',
              week: 'PP',
              month: 'MMM yyyy',
              quarter: 'qqq - yyyy',
              year: 'yyyy'
            }
          }
        },
        grid: {
          display: true,
          color: 'rgba(0,0,0,0.1)'
        }
      },
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: label
        },
        grid: {
          display: true,
          color: 'rgba(0,0,0,0.1)'
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0,0,0,0.7)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'white',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          title: (context: any) => {
            const date = new Date(context[0].parsed.x);
            return date.toLocaleTimeString();
          }
        }
      }
    },
    elements: {
      line: {
        tension: 0.1 // Reduce line tension for better performance
      },
      point: {
        radius: showPoints ? 2 : 0, // Smaller points for better performance
        hitRadius: 8
      }
    }
  }), [label, showPoints]); // Only recreate when these props change

  return (
    <div style={{ 
      width: '100%', 
      height: '300px', 
      margin: '0 auto',
      overflow: 'visible', // Changed from hidden to prevent clipping that might cause rendering issues
      border: '1px solid #eee',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      backgroundColor: 'white'
    }}>
      <h3 style={{ textAlign: 'center', marginBottom: '12px', color: '#333' }}>{label}</h3>
      {dataPoints.length === 0 ? (
        <div style={{ 
          display: 'flex', 
          height: '80%', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#666',
          flexDirection: 'column'
        }}>
          <div>Loading biomarker data...</div>
          <div style={{ fontSize: '12px', marginTop: '8px', color: '#999' }}>
            Connecting to WebSocket server...
          </div>
        </div>
      ) : (
        <div style={{ 
          height: 'calc(100% - 60px)',
          position: 'relative',
          backgroundColor: 'white'
        }}>
          <Line 
            data={chartData} 
            options={chartOptions}
            // Add key to force re-creation of chart when biomarker changes
            key={`chart-${biomarker}`} 
          />
        </div>
      )}
      <div style={{ 
        textAlign: 'center', 
        fontSize: '12px', 
        color: '#666', 
        marginTop: '8px',
        padding: '4px',
        borderTop: '1px solid #f0f0f0' 
      }}>
        Monitoring since {streamStartTime.current.toLocaleTimeString()} • {dataPoints.length} visible data points • {allDataPoints.current.length} total data points
      </div>
    </div>
  );
};

export default LiveDataGraph;