import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
  TimeScale,
  Filler
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import LiveDataGraph from './LiveDataGraph';

ChartJS.register(
  LineElement, 
  PointElement, 
  LinearScale, 
  Title, 
  CategoryScale, 
  Tooltip, 
  Legend,
  TimeScale,
  Filler
);

interface SquareGraphComponentProps {
  biomarker?: string;
  label?: string;
  color?: string;
  useLiveData?: boolean;
}

const SquareGraphComponent: React.FC<SquareGraphComponentProps> = ({
  biomarker = 'heart_rate_base',
  label = 'Heart Rate',
  color = 'rgba(75,192,192,1)',
  useLiveData = true
}) => {
  // Fallback static data
  const sampleData = {
    labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
    datasets: [
      {
        label: label,
        fill: false,
        tension: 0.4,
        backgroundColor: color.replace('1)', '0.4)'),
        borderColor: color,
        borderCapStyle: 'butt' as CanvasLineCap,
        borderJoinStyle: 'miter' as CanvasLineJoin,
        pointBorderColor: color,
        pointBackgroundColor: '#fff',
        pointBorderWidth: 1,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: 'rgba(220,220,220,1)',
        pointHoverBorderWidth: 2,
        pointRadius: 3,
        pointHitRadius: 10,
        data: [65, 59, 80, 81, 56, 55, 40]
      }
    ]
  };

  const sampleOptions = {
    maintainAspectRatio: false,
    responsive: true
  };

  return (
    <div style={{ 
      width: '300px', 
      height: '300px', 
      margin: '0 auto',
      overflow: 'hidden'
    }}>
      <div style={{ 
        height: '100%', 
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {useLiveData ? (
          <LiveDataGraph 
            biomarker={biomarker} 
            label={label} 
            color={color}
            showPoints={false}
            refreshInterval={2000}
          />
        ) : (
          <Line data={sampleData} options={sampleOptions} />
        )}
      </div>}
    </div>
  );
};

export default SquareGraphComponent;