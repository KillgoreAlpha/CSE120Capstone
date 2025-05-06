import React, { useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Typography, Card, Row, Col } from 'antd';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleExport = async () => {
      const input = pdfRef.current;
      if (!input) return;

      await new Promise(resolve => setTimeout(resolve, 1500));

      const canvas = await html2canvas(input, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff',
        width: 1122,
        height: input.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save('HealthData_Report.pdf');
    };

    window.addEventListener('exportPDF', handleExport);
    return () => window.removeEventListener('exportPDF', handleExport);
  }, []);

  const prepareVitalSignsData = () => {
    if (!healthData || !healthData.readings) return [];
    return healthData.readings.map(reading => ({
      time: new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      heartRate: reading.heart_rate_base,
      bodyTemp: reading.body_temp_base,
      bloodOxygen: reading.blood_oxygen_base
    }));
  };

  const prepareBiomarkersData = () => {
    if (!healthData || !healthData.readings) return [];
    return healthData.readings.map(reading => ({
      time: new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

  return (
    <div ref={pdfRef} style={{ width: '1122px', padding: '20px' }}>
      <Title level={3}>Health Data Report</Title>
      <Row justify="end" style={{ marginBottom: '10px' }}>
        <Col>
          <strong>Date:</strong> {new Date().toLocaleDateString()}
        </Col>
      </Row>

      <Title level={4}>Vital Signs Averages</Title>
      <Row gutter={[16, 16]}>
        <Col span={8}><Card title="Heart Rate (BPM)">{vitalSignsAverages.heartRate}</Card></Col>
        <Col span={8}><Card title="Body Temp (°C)">{vitalSignsAverages.bodyTemp}</Card></Col>
        <Col span={8}><Card title="Blood Oxygen (%)">{vitalSignsAverages.bloodOxygen}</Card></Col>
      </Row>

      <Title level={4} style={{ marginTop: '20px' }}>Biomarker Averages</Title>
      <Row gutter={[16, 16]}>
        <Col span={4}><Card title="Cortisol">{biomarkerAverages.cortisol}</Card></Col>
        <Col span={4}><Card title="Lactate">{biomarkerAverages.lactate}</Card></Col>
        <Col span={4}><Card title="Uric Acid">{biomarkerAverages.uricAcid}</Card></Col>
        <Col span={4}><Card title="CRP">{biomarkerAverages.crp}</Card></Col>
        <Col span={4}><Card title="IL-6">{biomarkerAverages.il6}</Card></Col>
      </Row>

      <Title level={4} style={{ marginTop: '20px' }}>Vital Signs</Title>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card title="Heart Rate">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={prepareVitalSignsData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line dataKey="heartRate" stroke="#FF8042" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Body Temp">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={prepareVitalSignsData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line dataKey="bodyTemp" stroke="#00C49F" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Blood Oxygen">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={prepareVitalSignsData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line dataKey="bloodOxygen" stroke="#FFBB28" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Title level={4} style={{ marginTop: '20px' }}>Biomarkers</Title>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={prepareBiomarkersData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="cortisol" stroke="#8884d8" name="Cortisol" />
              <Line dataKey="lactate" stroke="#82ca9d" name="Lactate" />
              <Line dataKey="uricAcid" stroke="#ffc658" name="Uric Acid" />
              <Line dataKey="crp" stroke="#ff8042" name="CRP" />
              <Line dataKey="il6" stroke="#0088FE" name="IL-6" />
            </LineChart>
          </ResponsiveContainer>
        </Col>
      </Row>
    </div>
  );
};

export default Datapdf;