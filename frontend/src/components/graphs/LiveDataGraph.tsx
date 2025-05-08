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

// Extend the WebSocket type to include our custom properties
interface CustomWebSocket extends WebSocket {
  lastFieldsReceived?: string;
  lastSubscriptionTime?: number;
  lastSimulationTime?: number;
  reconnectTimeout?: number; // For storing reconnection timeout ID
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
  
  // Helper function to generate simulated data for testing
  const generateSimulatedDataPoint = (): DataPoint => {
    // Generate a random value based on biomarker type
    let randomValue;
    switch(biomarker) {
      case 'heart_rate_base':
        randomValue = 60 + Math.random() * 40; // 60-100 bpm
        break;
      case 'body_temp_base':
        randomValue = 36.5 + Math.random() * 1.5; // 36.5-38.0 °C
        break;
      case 'blood_oxygen_base':
        randomValue = 95 + Math.random() * 5; // 95-100%
        break;
      case 'cortisol_base':
        randomValue = 10 + Math.random() * 15; // 10-25 μg/dL
        break;
      case 'lactate_base':
        randomValue = 1 + Math.random() * 3; // 1-4 mmol/L
        break;
      case 'uric_acid_base':
        randomValue = 3.5 + Math.random() * 3.5; // 3.5-7 mg/dL
        break;
      case 'crp_base':
        randomValue = Math.random() * 10; // 0-10 mg/L
        break;
      case 'il6_base':
        randomValue = Math.random() * 10; // 0-10 pg/mL
        break;
      default:
        randomValue = 50 + Math.random() * 50; // 50-100 generic value
    }
    
    return {
      timestamp: new Date().toISOString(),
      value: randomValue
    };
  };

  // WebSocket connection setup
  const wsRef = useRef<CustomWebSocket | null>(null);
  // Keep track of connection attempts to implement progressive backoff
  const connectionAttempts = useRef<number>(0);
  // Maximum number of active WebSocket connection attempts
  const MAX_CONNECTION_ATTEMPTS = 5;
  // Track if component is mounted
  const isMounted = useRef<boolean>(true);

  useEffect(() => {
    // Set mount status
    isMounted.current = true;
    
    // Set up WebSocket connection with retry mechanism
    const connectWebSocket = () => {
      // If component is unmounted, don't attempt connection
      if (!isMounted.current) {
        return;
      }
      
      // If we've already attempted too many connections, stop trying
      if (connectionAttempts.current >= MAX_CONNECTION_ATTEMPTS) {
        console.log(`Maximum WebSocket connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached for ${biomarker}, stopping attempts`);
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
      const wsUrl = 'ws://localhost:3000'; // Use port 3000 to match server
      console.log(`Connecting WebSocket to ${wsUrl} for ${biomarker} (attempt ${connectionAttempts.current})`);
      
      try {
        const ws = new WebSocket(wsUrl) as CustomWebSocket;
        wsRef.current = ws;
        
        ws.onopen = () => {
          if (!isMounted.current) {
            ws.close();
            return;
          }
          
          console.log(`WebSocket connected for ${biomarker} data`);
          
          // Send a subscription message for this specific biomarker
          try {
            ws.send(JSON.stringify({
              type: 'subscribe',
              biomarker: biomarker,
              clientInfo: {
                component: 'LiveDataGraph',
                timestamp: new Date().toISOString()
              }
            }));
            console.log(`Sent subscription request for ${biomarker}`);
          } catch (error) {
            console.error(`Error sending subscription for ${biomarker}:`, error);
          }
          
          // Reset connection attempts counter on successful connection
          connectionAttempts.current = 0;
          
          // Add a simulated data point when connection is established - for dev testing only
          const simulatedPoint = generateSimulatedDataPoint();
          dataBuffer.current.push(simulatedPoint);
          processBuffer.current();
        };
        
        ws.onmessage = (event) => {
          if (!isMounted.current) return;
          
          try {
            const data = JSON.parse(event.data);
            
            // Handle ping/pong messages from server
            if (data.type === 'ping') {
              // Respond with pong to keep connection alive
              ws.send(JSON.stringify({ 
                type: 'pong', 
                biomarker: biomarker, // Include biomarker in pong response
                timestamp: new Date().toISOString() 
              }));
              return;
            }
            
            // Handle echo responses
            if (data.type === 'echo') {
              return;
            }
            
            // Process data only if it contains our biomarker
            if (data && data[biomarker] !== undefined) {
              console.log(`Received real-time data for ${biomarker}: ${data[biomarker]}`);
              
              // Validate data before processing it
              const biomarkerValue = parseFloat(data[biomarker]);
              if (!isNaN(biomarkerValue)) {
                const newPoint: DataPoint = {
                  timestamp: data.timestamp || new Date().toISOString(),
                  value: biomarkerValue
                };
                
                // Add to buffer instead of immediately updating state
                dataBuffer.current.push(newPoint);
                
                // Process buffer immediately if we have enough points or enough time has passed
                const updateInterval = 1000; // Minimum time between state updates in ms
                if (dataBuffer.current.length >= 5 || (Date.now() - lastUpdateTime.current) > updateInterval) {
                  processBuffer.current();
                }
              } else {
                console.warn(`Invalid data received for ${biomarker}: ${data[biomarker]}`);
              }
            } else if (data && Object.keys(data).length > 0 && !data.type) {
              // If we receive data but not for our biomarker, log available fields without
              // flooding the console (only log if the fields have changed)
              const fieldsReceived = Object.keys(data).sort().join(',');
              if (ws.lastFieldsReceived !== fieldsReceived) {
                console.log(`Received data for other biomarkers: ${fieldsReceived}`);
                ws.lastFieldsReceived = fieldsReceived;
              }
              
              // Only try to resubscribe occasionally, not on every message
              const now = Date.now();
              if (!ws.lastSubscriptionTime || (now - ws.lastSubscriptionTime) > 10000) {
                try {
                  ws.send(JSON.stringify({
                    type: 'subscribe',
                    biomarker: biomarker,
                    timestamp: new Date().toISOString()
                  }));
                  ws.lastSubscriptionTime = now;
                } catch (sendError) {
                  console.error(`Error sending subscription for ${biomarker}:`, sendError);
                }
              }
              
              // For development/testing, generate a simulated point occasionally
              if (import.meta.env.DEV && (!ws.lastSimulationTime || (now - ws.lastSimulationTime) > 5000)) {
                const simPoint = generateSimulatedDataPoint();
                dataBuffer.current.push(simPoint);
                processBuffer.current();
                ws.lastSimulationTime = now;
              }
            }
          } catch (error) {
            console.error('Error processing WebSocket data:', error);
          }
        };
        
        ws.onerror = (error) => {
          if (!isMounted.current) return;
          console.warn(`WebSocket error for ${biomarker}:`, error);
        };
        
        ws.onclose = (event) => {
          if (!isMounted.current) return;
          
          console.log(`WebSocket connection closed for ${biomarker}. Code: ${event.code}, Reason: ${event.reason}`);
          
          // Check if this is a normal closure (code 1000) or a no-status closure (code 1005)
          const isNormalClosure = event.code === 1000 || event.code === 1005;
          
          // Calculate backoff delay based on number of attempts
          const baseDelay = 1000; // Start with 1 second
          const maxDelay = 30000; // Cap at 30 seconds
          const jitter = Math.random() * 1000; // Add random jitter to prevent all connections retrying at once
          
          // For normal closures, use a shorter fixed delay
          const backoffDelay = isNormalClosure 
            ? 2000 + jitter  // Shorter delay for normal closures
            : Math.min(maxDelay, (baseDelay * Math.pow(2, connectionAttempts.current)) + jitter);
          
          if (isMounted.current) {
            console.log(`Will attempt to reconnect WebSocket for ${biomarker} in ${backoffDelay}ms (attempt ${connectionAttempts.current + 1})`);
            
            // Add a bit more randomization for server restarts
            // When the server restarts, we don't want all websockets to try reconnecting at exactly the same time
            const reconnectDelay = backoffDelay + (biomarker.charCodeAt(0) % 10) * 500; // Stagger by biomarker name
            
            // Create a new timeout and store it so it can be cleared if needed
            const timeout = setTimeout(connectWebSocket, reconnectDelay);
            
            // Store the timeout ID in case we need to clean it up
            ws.reconnectTimeout = timeout;
          }
        };
      } catch (e) {
        console.error(`Error creating WebSocket for ${biomarker}:`, e);
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
    
    // Set up periodic data simulation if we're in development mode and need test data
    if (import.meta.env.DEV) {
      // This is optional and only for development - add a simulated data point every few seconds
      // for better visualization during testing
      const simulationInterval = window.setInterval(() => {
        if (isMounted.current) {
          // Only add simulated data if the WebSocket is not connected or not receiving data
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || dataPoints.length < 5) {
            console.log(`Adding simulated data point for ${biomarker} (development mode)`);
            const simPoint = generateSimulatedDataPoint();
            dataBuffer.current.push(simPoint);
            processBuffer.current();
          }
        }
      }, 5000); // Add simulated data every 5 seconds in dev mode
      
      // Save reference for cleanup
      intervalRef.current = simulationInterval;
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
      
      // Clean up WebSocket and any pending reconnect timeouts
      if (wsRef.current) {
        try {
          // Clear any reconnection timeout
          if (wsRef.current.reconnectTimeout) {
            clearTimeout(wsRef.current.reconnectTimeout);
          }
          
          // Close the WebSocket connection
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
    layout: {
      padding: {
        left: 0,
        right: 2,
        top: 2,
        bottom: 0
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
          display: false, // Removed title to save space
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
        },
        ticks: {
          maxRotation: 0, // Prevent label rotation
          autoSkip: true, // Skip labels that would overlap
          maxTicksLimit: 4, // Limit number of ticks to avoid clutter
          font: {
            size: 10 // Smaller font size
          }
        }
      },
      y: {
        beginAtZero: false,
        title: {
          display: false, // Removed title to save space
        },
        grid: {
          display: true,
          color: 'rgba(0,0,0,0.1)'
        },
        ticks: {
          font: {
            size: 10 // Smaller font size
          },
          maxTicksLimit: 5, // Limit number of ticks
          padding: 2 // Reduced padding
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
        padding: 6, // Reduced padding
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
      height: '100%', // Changed from fixed height to responsive
      margin: '0 auto',
      overflow: 'hidden', // Changed back to hidden to prevent overflow
      border: '1px solid #eee',
      borderRadius: '8px',
      padding: '12px', // Reduced padding
      boxSizing: 'border-box', // Ensure padding is included in element dimensions
      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      backgroundColor: 'white',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h3 style={{ 
        textAlign: 'center', 
        margin: '0 0 8px 0', // Reduced margin
        color: '#333',
        fontSize: '16px', // Smaller font size
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>{label}</h3>
      {dataPoints.length === 0 ? (
        <div style={{ 
          display: 'flex', 
          flex: '1',
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
          flex: '1',
          position: 'relative',
          backgroundColor: 'white',
          minHeight: 0 // Important for flex sizing
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
        fontSize: '10px', // Smaller font
        color: '#666', 
        marginTop: '4px', // Reduced margin
        padding: '2px', // Reduced padding
        borderTop: '1px solid #f0f0f0',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        Since {streamStartTime.current.toLocaleTimeString()} • {dataPoints.length} points
      </div>
    </div>
  );
};

export default LiveDataGraph;