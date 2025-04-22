import React from 'react';
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
  const biomarkers = [
    { 
      id: 'heart_rate', 
      label: 'Heart Rate (BPM)', 
      color: 'rgba(255,99,132,1)' 
    },
    { 
      id: 'body_temp', 
      label: 'Body Temperature (°C)', 
      color: 'rgba(255,159,64,1)' 
    },
    { 
      id: 'blood_oxygen', 
      label: 'Blood Oxygen (%)', 
      color: 'rgba(54,162,235,1)' 
    },
    { 
      id: 'cortisol', 
      label: 'Cortisol (μg/dL)', 
      color: 'rgba(153,102,255,1)' 
    },
    { 
      id: 'lactate', 
      label: 'Lactate (mmol/L)', 
      color: 'rgba(75,192,192,1)' 
    },
    { 
      id: 'uric_acid', 
      label: 'Uric Acid (mg/dL)', 
      color: 'rgba(255,206,86,1)' 
    },
    { 
      id: 'crp', 
      label: 'C-Reactive Protein (mg/L)', 
      color: 'rgba(75,192,75,1)' 
    },
    { 
      id: 'il6', 
      label: 'IL-6 (pg/mL)', 
      color: 'rgba(201,203,207,1)' 
    }
  ];

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '20px'
    }}>
      <h2 style={{ 
        textAlign: 'center', 
        marginBottom: '20px',
        color: '#333'
      }}>
        Real-Time Biomarker Monitoring
      </h2>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))', 
        gap: '20px'
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
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px',
        fontSize: '14px',
        color: '#666'
      }}>
        <h4 style={{ marginTop: 0 }}>About This Dashboard</h4>
        <p>
          This dashboard displays real-time biomarker data from the simulation. Data is refreshed every {refreshInterval/1000} seconds.
          The graphs show the most recent readings for each biomarker, with normal ranges indicated where applicable.
        </p>
        <p>
          <strong>Note:</strong> This is simulated data for demonstration purposes only and should not be used for medical diagnosis.
        </p>
      </div>
    </div>
  );
};

export default LiveDataDashboard;