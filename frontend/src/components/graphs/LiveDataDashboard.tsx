import React, { useMemo } from 'react';
import LiveDataGraph from './LiveDataGraph';

interface LiveDataDashboardProps {
  refreshInterval?: number;
  showPoints?: boolean;
}

const LiveDataDashboard: React.FC<LiveDataDashboardProps> = ({
  refreshInterval = 1000,
  showPoints = true
}) => {
  // Biomarker configuration with display names and colors
  // Use useMemo to prevent re-creating this array on each render
  const biomarkers = useMemo(() => [
    { 
      id: 'heart_rate_base', 
      label: 'Heart Rate (BPM)', 
      color: 'rgba(255,99,132,1)' 
    },
    { 
      id: 'body_temp_base', 
      label: 'Body Temperature (°C)', 
      color: 'rgba(255,159,64,1)' 
    },
    { 
      id: 'blood_oxygen_base', 
      label: 'Blood Oxygen (%)', 
      color: 'rgba(54,162,235,1)' 
    },
    { 
      id: 'cortisol_base', 
      label: 'Cortisol (μg/dL)', 
      color: 'rgba(153,102,255,1)' 
    },
    { 
      id: 'lactate_base', 
      label: 'Lactate (mmol/L)', 
      color: 'rgba(75,192,192,1)' 
    },
    { 
      id: 'uric_acid_base', 
      label: 'Uric Acid (mg/dL)', 
      color: 'rgba(255,206,86,1)' 
    },
    { 
      id: 'crp_base', 
      label: 'C-Reactive Protein (mg/L)', 
      color: 'rgba(75,192,75,1)' 
    },
    { 
      id: 'il6_base', 
      label: 'IL-6 (pg/mL)', 
      color: 'rgba(201,203,207,1)' 
    }
  ], []);

  return (
    <div style={{ 
      maxWidth: '1200px',
      width: '100%', 
      margin: '0 auto', 
      padding: '20px',
      background: '#f8f9fa'
    }}>
      <h2 style={{ 
        textAlign: 'center', 
        marginBottom: '20px',
        color: '#333',
        padding: '12px',
        borderBottom: '1px solid #e1e4e8'
      }}>
        Real-Time Biomarker Monitoring
      </h2>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '24px',
        marginBottom: '30px'
      }}>
        {biomarkers.map(biomarker => (
          <LiveDataGraph 
            key={biomarker.id}
            biomarker={biomarker.id}
            label={biomarker.label}
            color={biomarker.color}
            refreshInterval={refreshInterval}
            showPoints={showPoints}
          />
        ))}
      </div>

      <div style={{ 
        marginTop: '30px', 
        padding: '20px', 
        backgroundColor: 'white', 
        borderRadius: '8px',
        fontSize: '14px',
        color: '#666',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h4 style={{ marginTop: 0, color: '#333' }}>About This Dashboard</h4>
        <p>
          This dashboard displays real-time biomarker data from the simulation. Data is refreshed every {refreshInterval/1000} seconds.
          The graphs show the most recent readings for each biomarker, with normal ranges indicated where applicable.
        </p>
        <p>
          <strong>Note:</strong> This is simulated data for demonstration purposes only and should not be used for medical diagnosis.
        </p>
        <p>
          <strong>Connection Status:</strong> Data is streamed via WebSocket with REST API fallback for reliable real-time updates.
        </p>
      </div>
    </div>
  );
};

export default LiveDataDashboard;