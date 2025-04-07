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
  Legend
} from 'chart.js';

ChartJS.register(LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend);

const sampleData = {
  labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
  datasets: [
    {
      label: 'Random Data',
      fill: false,
      tension: 0.4,
      backgroundColor: 'rgba(75,192,192,0.4)',
      borderColor: 'rgba(75,192,192,1)',
      borderCapStyle: 'butt' as CanvasLineCap,
      borderJoinStyle: 'miter' as CanvasLineJoin,
      pointBorderColor: 'rgba(75,192,192,1)',
      pointBackgroundColor: '#fff',
      pointBorderWidth: 1,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: 'rgba(75,192,192,1)',
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

const SquareGraphComponent: React.FC = () => {
  return (
    <div style={{ 
      width: '300px', 
      height: '300px', 
      margin: '0 auto',
      overflow: 'hidden'
    }}>
      <Line data={sampleData} options={sampleOptions} />
    </div>
  );
};

export default SquareGraphComponent; 