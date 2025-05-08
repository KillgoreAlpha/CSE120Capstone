import React, { useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import { Typography, Card, Row, Col, message } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const { Title } = Typography;

interface BiomarkerReading {
  timestamp: string;
  cortisol_base: number;
  lactate_base: number;
  uric_acid_base: number;
  crp_base: number;
  il6_base: number;
  body_temp_base: number;
  heart_rate_base: number;
  blood_oxygen_base: number;
}

interface HealthData {
  readings: BiomarkerReading[];
}

const Datapdf: React.FC<{ healthData: HealthData | null; loading: boolean; userName: string }> = ({ healthData, loading, userName }) => {
  const [isReady, setIsReady] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);

  // Function to prepare vital signs data
  const prepareVitalSignsData = () => {
    if (!healthData || !healthData.readings) return [];
    // Sort readings by timestamp
    const sortedReadings = [...healthData.readings].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    return sortedReadings.map(reading => ({
      time: reading.timestamp, // Pass the full timestamp
      heartRate: reading.heart_rate_base,
      bodyTemp: reading.body_temp_base,
      bloodOxygen: reading.blood_oxygen_base
    }));
  };

  // Function to prepare biomarkers data
  const prepareBiomarkersData = () => {
    if (!healthData || !healthData.readings) return [];
    // Sort readings by timestamp
    const sortedReadings = [...healthData.readings].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    return sortedReadings.map(reading => ({
      time: reading.timestamp, // Pass the full timestamp
      cortisol: reading.cortisol_base,
      lactate: reading.lactate_base,
      uricAcid: reading.uric_acid_base,
      crp: reading.crp_base,
      il6: reading.il6_base
    }));
  };

  // Compute averages
  const vitalSignsAverages = {
    heartRate: healthData && healthData.readings.length ? 
      (healthData.readings.reduce((sum, r) => sum + r.heart_rate_base, 0) / healthData.readings.length).toFixed(1) : 'N/A',
    bodyTemp: healthData && healthData.readings.length ? 
      (healthData.readings.reduce((sum, r) => sum + r.body_temp_base, 0) / healthData.readings.length).toFixed(1) : 'N/A',
    bloodOxygen: healthData && healthData.readings.length ? 
      (healthData.readings.reduce((sum, r) => sum + r.blood_oxygen_base, 0) / healthData.readings.length).toFixed(1) : 'N/A'
  };

  const biomarkerAverages = {
    cortisol: healthData && healthData.readings.length ? 
      (healthData.readings.reduce((sum, r) => sum + r.cortisol_base, 0) / healthData.readings.length).toFixed(1) : 'N/A',
    lactate: healthData && healthData.readings.length ? 
      (healthData.readings.reduce((sum, r) => sum + r.lactate_base, 0) / healthData.readings.length).toFixed(1) : 'N/A',
    uricAcid: healthData && healthData.readings.length ? 
      (healthData.readings.reduce((sum, r) => sum + r.uric_acid_base, 0) / healthData.readings.length).toFixed(1) : 'N/A',
    crp: healthData && healthData.readings.length ? 
      (healthData.readings.reduce((sum, r) => sum + r.crp_base, 0) / healthData.readings.length).toFixed(1) : 'N/A',
    il6: healthData && healthData.readings.length ? 
      (healthData.readings.reduce((sum, r) => sum + r.il6_base, 0) / healthData.readings.length).toFixed(1) : 'N/A'
  };

  // Function to draw a line chart
  const drawLineChart = (
    pdf: jsPDF,
    data: any[],
    xKey: string,
    yKey: string,
    title: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    if (!data || data.length === 0) return y;

    // Draw title
    pdf.setFontSize(14);
    pdf.text(title, x, y);
    y += 10;

    // Calculate min and max values
    const values = data.map(d => d[yKey]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1; // 10% padding

    // Draw axes
    const chartHeight = height - 30;
    const chartWidth = width - 40;
    const xAxisY = y + chartHeight;
    const yAxisX = x + 40;

    // Draw Y-axis
    pdf.line(yAxisX, y, yAxisX, xAxisY);
    // Draw X-axis
    pdf.line(yAxisX, xAxisY, yAxisX + chartWidth, xAxisY);

    // Draw Y-axis labels
    pdf.setFontSize(8);
    pdf.text(min.toFixed(1), yAxisX - 20, xAxisY);
    pdf.text(max.toFixed(1), yAxisX - 20, y);

    // Draw grid lines
    pdf.setDrawColor(200);
    const numGridLines = 5;
    for (let i = 0; i <= numGridLines; i++) {
      const gridY = y + (chartHeight * i / numGridLines);
      pdf.line(yAxisX, gridY, yAxisX + chartWidth, gridY);
    }
    pdf.setDrawColor(0);

    // Draw data points and lines
    const xStep = chartWidth / (data.length - 1);
    const yScale = chartHeight / (max - min + 2 * padding);

    // Draw data points and connecting lines
    pdf.setDrawColor(0, 0, 255); // Blue color for the line
    pdf.setLineWidth(0.5);

    // Draw the line
    for (let i = 0; i < data.length - 1; i++) {
      const x1 = yAxisX + (i * xStep);
      const y1 = xAxisY - ((data[i][yKey] - min + padding) * yScale);
      const x2 = yAxisX + ((i + 1) * xStep);
      const y2 = xAxisY - ((data[i + 1][yKey] - min + padding) * yScale);
      pdf.line(x1, y1, x2, y2);
    }

    // Draw X-axis labels and grid lines
    pdf.setFontSize(8);
    const numLabels = Math.min(5, data.length); // Show at most 5 labels
    const labelStep = Math.floor(data.length / numLabels);
    
    // Draw vertical grid lines and labels
    pdf.setDrawColor(200); // Light gray for grid lines
    for (let i = 0; i < data.length; i += labelStep) {
      const labelX = yAxisX + (i * xStep);
      
      // Draw vertical grid line
      pdf.line(labelX, y, labelX, xAxisY);
      
      // Draw time label
      const timestamp = new Date(data[i][xKey]);
      const timeLabel = timestamp.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      
      // Center the label under the grid line with increased spacing
      const labelWidth = pdf.getStringUnitWidth(timeLabel) * 8; // Approximate width of text
      pdf.text(timeLabel, labelX - (labelWidth / 2), xAxisY + 12); // Changed from 5 to 12 for more spacing
    }
    pdf.setDrawColor(0); // Reset to black

    return y + height;
  };

  // Function to add page number
  const addPageNumber = (pdf: jsPDF, pageNumber: number) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.setFontSize(10);
    pdf.text(`Page ${pageNumber}`, pageWidth - 60, pdf.internal.pageSize.getHeight() - 20);
  };

  // Function to check if we need a new page
  const checkNewPage = (pdf: jsPDF, y: number, margin: number, contentHeight: number): number => {
    const pageHeight = pdf.internal.pageSize.getHeight();
    if (y + contentHeight > pageHeight - margin) {
      pdf.addPage();
      addPageNumber(pdf, pdf.getNumberOfPages());
      return margin;
    }
    return y;
  };

  useEffect(() => {
    // Set ready state after a delay to ensure charts are rendered
    const timer = setTimeout(() => {
      setIsReady(true);
      // Additional delay for charts to render
      setTimeout(() => {
        setChartsReady(true);
      }, 1000);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleExport = async () => {
      if (!isReady || !chartsReady) return;

      try {
        message.loading({ content: 'Generating PDF...', key: 'pdfLoading' });

        // Create PDF with A4 dimensions
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const margin = 40;
        let y = margin;

        // Add title
        pdf.setFontSize(24);
        pdf.text('Health Data Report', margin, y);
        y += 40;

        // Add date
        pdf.setFontSize(12);
        pdf.text(`Date: ${new Date().toLocaleDateString()}`, margin, y);
        y += 30;

        // Add vital signs averages
        pdf.setFontSize(16);
        pdf.text('Vital Signs Averages', margin, y);
        y += 20;

        pdf.setFontSize(12);
        pdf.text(`Heart Rate: ${vitalSignsAverages.heartRate} BPM`, margin, y);
        y += 15;
        pdf.text(`Body Temperature: ${vitalSignsAverages.bodyTemp} °C`, margin, y);
        y += 15;
        pdf.text(`Blood Oxygen: ${vitalSignsAverages.bloodOxygen} %`, margin, y);
        y += 30;

        // Add vital signs charts
        const vitalSignsData = prepareVitalSignsData();
        if (vitalSignsData.length > 0) {
          // Check if we need a new page for the first chart
          y = checkNewPage(pdf, y, margin, 200);
          y = drawLineChart(pdf, vitalSignsData, 'time', 'heartRate', 'Heart Rate (BPM)', margin, y, pdfWidth - 2 * margin, 150);
          
          y = checkNewPage(pdf, y, margin, 200);
          y = drawLineChart(pdf, vitalSignsData, 'time', 'bodyTemp', 'Body Temperature (°C)', margin, y, pdfWidth - 2 * margin, 150);
          
          y = checkNewPage(pdf, y, margin, 200);
          y = drawLineChart(pdf, vitalSignsData, 'time', 'bloodOxygen', 'Blood Oxygen (%)', margin, y, pdfWidth - 2 * margin, 150);
        }

        // Add biomarker averages
        y = checkNewPage(pdf, y, margin, 100);
        pdf.setFontSize(16);
        pdf.text('Biomarker Averages', margin, y);
        y += 20;

        pdf.setFontSize(12);
        pdf.text(`Cortisol: ${biomarkerAverages.cortisol} nmol/L`, margin, y);
        y += 15;
        pdf.text(`Lactate: ${biomarkerAverages.lactate} mmol/L`, margin, y);
        y += 15;
        pdf.text(`Uric Acid: ${biomarkerAverages.uricAcid} mg/dL`, margin, y);
        y += 15;
        pdf.text(`CRP: ${biomarkerAverages.crp} mg/L`, margin, y);
        y += 15;
        pdf.text(`IL-6: ${biomarkerAverages.il6} pg/mL`, margin, y);
        y += 30;

        // Add biomarker charts
        const biomarkerData = prepareBiomarkersData();
        if (biomarkerData.length > 0) {
          y = checkNewPage(pdf, y, margin, 200);
          y = drawLineChart(pdf, biomarkerData, 'time', 'cortisol', 'Cortisol (nmol/L)', margin, y, pdfWidth - 2 * margin, 150);
          
          y = checkNewPage(pdf, y, margin, 200);
          y = drawLineChart(pdf, biomarkerData, 'time', 'lactate', 'Lactate (mmol/L)', margin, y, pdfWidth - 2 * margin, 150);
          
          y = checkNewPage(pdf, y, margin, 200);
          y = drawLineChart(pdf, biomarkerData, 'time', 'uricAcid', 'Uric Acid (mg/dL)', margin, y, pdfWidth - 2 * margin, 150);
          
          y = checkNewPage(pdf, y, margin, 200);
          y = drawLineChart(pdf, biomarkerData, 'time', 'crp', 'CRP (mg/L)', margin, y, pdfWidth - 2 * margin, 150);
          
          y = checkNewPage(pdf, y, margin, 200);
          y = drawLineChart(pdf, biomarkerData, 'time', 'il6', 'IL-6 (pg/mL)', margin, y, pdfWidth - 2 * margin, 150);
        }

        // Add recent readings
        if (healthData && healthData.readings.length > 0) {
          y = checkNewPage(pdf, y, margin, 200);
          pdf.setFontSize(16);
          pdf.text('Recent Readings', margin, y);
          y += 20;

          pdf.setFontSize(10);
          const recentReadings = healthData.readings.slice(0, 5);
          recentReadings.forEach(reading => {
            y = checkNewPage(pdf, y, margin, 60);
            const date = new Date(reading.timestamp).toLocaleString();
            pdf.text(`Time: ${date}`, margin, y);
            y += 12;
            pdf.text(`Heart Rate: ${reading.heart_rate_base} BPM`, margin, y);
            y += 12;
            pdf.text(`Body Temperature: ${reading.body_temp_base} °C`, margin, y);
            y += 12;
            pdf.text(`Blood Oxygen: ${reading.blood_oxygen_base} %`, margin, y);
            y += 20;
          });
        }

        // Add page numbers to all pages
        const totalPages = pdf.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          addPageNumber(pdf, i);
        }

        // Save the PDF
        pdf.save('HealthData_Report.pdf');
        
        message.success({ content: 'PDF generated successfully!', key: 'pdfLoading' });
      } catch (error) {
        console.error('Error generating PDF:', error);
        message.error({ content: 'Failed to generate PDF. Please try again.', key: 'pdfLoading' });
      }
    };

    window.addEventListener('exportPDF', handleExport);
    return () => window.removeEventListener('exportPDF', handleExport);
  }, [isReady, chartsReady, healthData]);

  return null;
};

export default Datapdf;