import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Button } from 'antd';
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

// Register the components
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

interface GraphComponentProps {
  biomarker?: string;
  label?: string;
  color?: string;
}

const GraphComponent: React.FC<GraphComponentProps> = ({
  biomarker = 'heart_rate_base',
  label = 'Heart Rate',
  color = 'rgba(75,192,192,1)'
}) => {
  const [showLiveData, setShowLiveData] = useState(true);
  
  // Fallback to static data if needed
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

  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Get the current date for the title
    const currentDate = new Date().toLocaleDateString();

    // Create the print content
    const printContent = `
      <html>
        <head>
          <title>Health Data Report - ${currentDate}</title>
          <style>
            @media print {
              body {
                width: 100%;
                margin: 0;
                padding: 20px;
              }
              .chart-container {
                width: 100%;
                max-width: 800px;
                margin: 0 auto;
                page-break-inside: avoid;
              }
              .data-table {
                width: 100%;
                max-width: 800px;
                margin: 20px auto;
                border-collapse: collapse;
              }
              .data-table th, .data-table td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
              }
              .data-table th {
                background-color: #f5f5f5;
              }
            }
          </style>
        </head>
        <body>
          <h1 style="text-align: center;">Health Data Report</h1>
          <p style="text-align: center;">Generated on: ${currentDate}</p>
          
          <div class="chart-container">
            <h2>Monthly Health Data</h2>
            <div id="chart"></div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              ${sampleData.labels.map((label, index) => `
                <tr>
                  <td>${label}</td>
                  <td>${sampleData.datasets[0].data[index]}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    // Write the content to the new window
    printWindow.document.write(printContent);
    printWindow.document.close();

    // Wait for the content to load before printing
    printWindow.onload = () => {
      printWindow.print();
      // Close the window after printing
      printWindow.onafterprint = () => printWindow.close();
    };
  };

  return (
    <div style={{ 
      width: '100%', 
      height: '400px',
      position: 'relative',
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '10px',
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 1000
      }}>
        <Button 
          type="primary" 
          onClick={handlePrint}
          style={{
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }}
        >
          Print Report
        </Button>
        <Button 
          type="default"
          style={{
            backgroundColor: '#fff',
            border: '1px solid #d9d9d9',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={() => setShowLiveData(!showLiveData)}
        >
          {showLiveData ? 'Show Static Data' : 'Show Live Data'}
        </Button>
      </div>
      
      <div style={{ 
        height: '100%', 
        width: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center'
      }}>
        {showLiveData ? (
          <LiveDataGraph 
            biomarker={biomarker} 
            label={label} 
            color={color}
            showPoints={true}
            refreshInterval={1000}
          />
        ) : (
          <Line data={sampleData} options={sampleOptions} />
        )}
      </div>}
    </div>
  );
};

export default GraphComponent;