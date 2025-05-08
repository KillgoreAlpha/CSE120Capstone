import React, { useState, useEffect } from 'react';
import {
  Modal,
  Steps,
  Button,
  Form,
  Input,
  Select,
  Radio,
  Space,
  Typography,
  InputNumber,
  Switch,
  DatePicker,
  Row,
  Col,
  Divider
} from 'antd';

const { Title, Text } = Typography;
const { Step } = Steps;
const { Option } = Select;

interface UserHealthProfile {
  age?: number;
  gender?: string;
  height?: number; // in cm
  weight?: number; // in kg
  preExistingConditions?: string[];
  alcohol?: string; // none, occasional, moderate, heavy
  smoking?: string; // none, occasional, regular, heavy
  drugUse?: boolean;
  exerciseLevel?: string; // none, light, moderate, intense
  exerciseFrequency?: number; // times per week
  sleepHours?: number;
  stressLevel?: string; // low, moderate, high
  dietType?: string; // omnivore, vegetarian, vegan, other
  language?: string; // preferred language
}

interface UserHealthProfileFormProps {
  userId: string | null;
  visible: boolean;
  onClose: () => void;
  onComplete: (profileData: UserHealthProfile) => void;
}

// Storage key for the health profile in browser local storage
const STORAGE_KEY = 'userHealthProfile';

// Unit conversion functions
const cmToFeet = (cm: number): number => {
  return Math.floor(cm / 30.48);
};

const cmToInches = (cm: number): number => {
  const totalInches = cm / 2.54;
  return Math.round(totalInches % 12);
};

const feetInchesToCm = (feet: number, inches: number): number => {
  return (feet * 30.48) + (inches * 2.54);
};

const kgToLbs = (kg: number): number => {
  return Math.round(kg * 2.20462);
};

const lbsToKg = (lbs: number): number => {
  return Math.round(lbs / 2.20462 * 10) / 10; // Round to 1 decimal place
};

const UserHealthProfileForm: React.FC<UserHealthProfileFormProps> = ({
  userId,
  visible,
  onClose,
  onComplete
}) => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [userData, setUserData] = useState<UserHealthProfile>({});
  const [useMetric, setUseMetric] = useState(true);
  const [feet, setFeet] = useState<number | null>(null);
  const [inches, setInches] = useState<number | null>(0);

  // Check if user already has a profile
  useEffect(() => {
    if (userId && visible) {
      // We don't need to load from localStorage anymore as the profile will be 
      // passed to this component via props by the parent component using
      // the useUserHealthProfile hook, which now fetches from the server
    }
  }, [userId, visible, form]);
  
  // Convert height from cm to feet/inches when form data or unit preference changes
  useEffect(() => {
    const currentHeight = form.getFieldValue('height');
    if (currentHeight && !useMetric) {
      setFeet(cmToFeet(currentHeight));
      setInches(cmToInches(currentHeight));
    }
  }, [form, useMetric]);

  // Convert form values from imperial to metric if needed
  const convertToMetricUnits = (values: any) => {
    const result = { ...values };
    
    // If using imperial units, convert height and weight to metric
    if (!useMetric) {
      // Convert feet/inches to cm for height
      if (feet !== null && inches !== null) {
        result.height = feetInchesToCm(feet, inches);
      }
      
      // Convert lbs to kg for weight
      if (result.weight) {
        result.weight = lbsToKg(result.weight);
      }
    }
    
    return result;
  };

  // Handle form completion
  const handleComplete = () => {
    form.validateFields().then(values => {
      // Convert to metric units if needed
      const metricValues = convertToMetricUnits(values);
      
      // Combine previous steps data with current step
      const updatedProfile = { ...userData, ...metricValues };
      setUserData(updatedProfile);
      
      // Pass data back to the parent component, which will save to the server
      onComplete(updatedProfile);
    });
  };

  // Handle next step
  const handleNext = () => {
    form.validateFields().then(values => {
      // Convert to metric units if needed
      const metricValues = convertToMetricUnits(values);
      
      // Save current step data
      const updatedProfile = { ...userData, ...metricValues };
      setUserData(updatedProfile);
      
      // Move to next step
      setCurrentStep(currentStep + 1);
      
      // Update form with saved values for the next step
      form.setFieldsValue(updatedProfile);
    });
  };

  // Handle previous step
  const handlePrevious = () => {
    // Save current form values even if not validated
    const currentValues = form.getFieldsValue();
    const updatedProfile = { ...userData, ...currentValues };
    setUserData(updatedProfile);
    
    // Move to previous step
    setCurrentStep(currentStep - 1);
    
    // Set form values for previous step
    form.setFieldsValue(updatedProfile);
  };

  // Function to handle unit toggle
  const handleUnitToggle = (checked: boolean) => {
    setUseMetric(checked);
    
    const currentHeight = form.getFieldValue('height');
    const currentWeight = form.getFieldValue('weight');
    
    if (checked) {
      // Switching to metric
      // Convert feet/inches to cm
      if (feet !== null && inches !== null) {
        const heightInCm = feetInchesToCm(feet, inches);
        form.setFieldValue('height', heightInCm);
      }
      
      // Convert lbs to kg
      if (currentWeight) {
        form.setFieldValue('weight', lbsToKg(currentWeight));
      }
    } else {
      // Switching to imperial
      // Convert cm to feet/inches
      if (currentHeight) {
        setFeet(cmToFeet(currentHeight));
        setInches(cmToInches(currentHeight));
      }
      
      // Convert kg to lbs
      if (currentWeight) {
        form.setFieldValue('weight', kgToLbs(currentWeight));
      }
    }
  };
  
  // Handle feet input change
  const handleFeetChange = (value: number | null) => {
    setFeet(value);
    if (value !== null && inches !== null) {
      const heightInCm = feetInchesToCm(value, inches);
      form.setFieldValue('height', heightInCm);
    }
  };
  
  // Handle inches input change
  const handleInchesChange = (value: number | null) => {
    setInches(value);
    if (feet !== null && value !== null) {
      const heightInCm = feetInchesToCm(feet, value);
      form.setFieldValue('height', heightInCm);
    }
  };

  // Define a single form context
  const renderForm = (stepIndex: number) => {
    switch(stepIndex) {
      case 0:
        return (
          <div style={{ marginBottom: '16px', textAlign: 'right' }}>
            <Space align="center">
              <Text>Imperial</Text>
              <Switch checked={useMetric} onChange={handleUnitToggle} />
              <Text>Metric</Text>
            </Space>
          </div>
        );
      default:
        return null;
    }
  };
  
  // Steps content definitions
  const steps = [
    {
      title: 'Basic Information',
      content: (
        <>
          {renderForm(0)}
          
          <Form.Item
            name="age"
            label="Age"
            rules={[{ required: true, message: 'Please enter your age' }]}
          >
            <InputNumber min={1} max={120} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="gender"
            label="Gender"
            rules={[{ required: true, message: 'Please select your gender' }]}
          >
            <Select placeholder="Select your gender">
              <Option value="male">Male</Option>
              <Option value="female">Female</Option>
              <Option value="non-binary">Non-binary</Option>
              <Option value="prefer-not-to-say">Prefer not to say</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="language"
            label="Preferred Language"
            rules={[{ required: true, message: 'Please select your preferred language' }]}
          >
            <Select placeholder="Select your preferred language">
              <Option value="english">English</Option>
              <Option value="spanish">Spanish</Option>
              <Option value="french">French</Option>
              <Option value="german">German</Option>
              <Option value="chinese">Chinese</Option>
              <Option value="japanese">Japanese</Option>
              <Option value="korean">Korean</Option>
              <Option value="arabic">Arabic</Option>
              <Option value="russian">Russian</Option>
              <Option value="portuguese">Portuguese</Option>
              <Option value="italian">Italian</Option>
              <Option value="hindi">Hindi</Option>
            </Select>
          </Form.Item>
          
          {useMetric ? (
            // Metric height input (cm)
            <Form.Item name="height" label="Height (cm)">
              <InputNumber min={1} max={300} style={{ width: '100%' }} />
            </Form.Item>
          ) : (
            // Imperial height input (feet and inches)
            <Form.Item label="Height (ft & in)">
              <Row gutter={8}>
                <Col span={12}>
                  <InputNumber
                    min={0}
                    max={9}
                    value={feet}
                    onChange={handleFeetChange}
                    style={{ width: '100%' }}
                    addonAfter="ft"
                  />
                </Col>
                <Col span={12}>
                  <InputNumber
                    min={0}
                    max={11}
                    value={inches}
                    onChange={handleInchesChange}
                    style={{ width: '100%' }}
                    addonAfter="in"
                  />
                </Col>
              </Row>
            </Form.Item>
          )}
          
          <Form.Item name="weight" label={`Weight (${useMetric ? 'kg' : 'lbs'})`}>
            <InputNumber 
              min={1} 
              max={useMetric ? 500 : 1100} 
              style={{ width: '100%' }} 
            />
          </Form.Item>
        </>
      )
    },
    {
      title: 'Health Conditions',
      content: (
        <>
          <Form.Item
            name="preExistingConditions"
            label="Pre-existing Conditions"
            help="Select all that apply"
          >
            <Select mode="multiple" placeholder="Select conditions">
              <Option value="diabetes">Diabetes</Option>
              <Option value="hypertension">Hypertension</Option>
              <Option value="heart-disease">Heart Disease</Option>
              <Option value="asthma">Asthma</Option>
              <Option value="depression">Depression</Option>
              <Option value="anxiety">Anxiety</Option>
              <Option value="hyperthyroidism">Hyperthyroidism</Option>
              <Option value="hypothyroidism">Hypothyroidism</Option>
              <Option value="arthritis">Arthritis</Option>
              <Option value="cancer">Cancer</Option>
              <Option value="none">None</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="alcohol"
            label="Alcohol Consumption"
          >
            <Radio.Group>
              <Radio value="none">None</Radio>
              <Radio value="occasional">Occasional (1-2 drinks/week)</Radio>
              <Radio value="moderate">Moderate (3-7 drinks/week)</Radio>
              <Radio value="heavy">Heavy (8+ drinks/week)</Radio>
            </Radio.Group>
          </Form.Item>
          
          <Form.Item
            name="smoking"
            label="Smoking"
          >
            <Radio.Group>
              <Radio value="none">Non-smoker</Radio>
              <Radio value="occasional">Occasional</Radio>
              <Radio value="regular">Regular</Radio>
              <Radio value="heavy">Heavy</Radio>
            </Radio.Group>
          </Form.Item>
          
          <Form.Item
            name="drugUse"
            label="Recreational Drug Use"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </>
      )
    },
    {
      title: 'Lifestyle',
      content: (
        <>
          <Form.Item
            name="exerciseLevel"
            label="Exercise Level"
          >
            <Radio.Group>
              <Radio value="none">None</Radio>
              <Radio value="light">Light (walking, yoga)</Radio>
              <Radio value="moderate">Moderate (jogging, cycling)</Radio>
              <Radio value="intense">Intense (HIIT, weight training)</Radio>
            </Radio.Group>
          </Form.Item>
          
          <Form.Item
            name="exerciseFrequency"
            label="Exercise Frequency (times per week)"
          >
            <InputNumber min={0} max={30} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="sleepHours"
            label="Average Sleep (hours per night)"
          >
            <InputNumber min={0} max={24} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="stressLevel"
            label="Stress Level"
          >
            <Radio.Group>
              <Radio value="low">Low</Radio>
              <Radio value="moderate">Moderate</Radio>
              <Radio value="high">High</Radio>
            </Radio.Group>
          </Form.Item>
          
          <Form.Item
            name="dietType"
            label="Diet Type"
          >
            <Select placeholder="Select diet type">
              <Option value="omnivore">Omnivore</Option>
              <Option value="vegetarian">Vegetarian</Option>
              <Option value="vegan">Vegan</Option>
              <Option value="pescatarian">Pescatarian</Option>
              <Option value="keto">Keto</Option>
              <Option value="paleo">Paleo</Option>
              <Option value="other">Other</Option>
            </Select>
          </Form.Item>
        </>
      )
    }
  ];

  return (
    <Modal
      title="Health Profile"
      open={visible}
      onCancel={onClose}
      footer={null}
      width="95%"
      style={{ maxWidth: 600 }}
      styles={{ 
        mask: { backdropFilter: 'blur(5px)' },
        body: { padding: '16px' }
      }}
      destroyOnClose={false}
      centered
    >
      <div style={{ padding: '10px 0' }}>
        <Steps 
          current={currentStep}
          size="small"
          responsive
          style={{
            maxWidth: '100%',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {steps.map(step => (
            <Step key={step.title} title={step.title} />
          ))}
        </Steps>
        
        <div style={{ margin: '24px 0', overflowY: 'auto', maxHeight: 'calc(70vh - 200px)' }}>
          <Form 
            form={form} 
            layout="vertical" 
            initialValues={userData}
          >
            {steps[currentStep].content}
          </Form>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          {currentStep > 0 && (
            <Button 
              onClick={handlePrevious}
              size="middle"
            >
              Previous
            </Button>
          )}
          <div style={{ marginLeft: 'auto' }}>
            {currentStep < steps.length - 1 && (
              <Button 
                type="primary" 
                onClick={handleNext}
                size="middle"
              >
                Next
              </Button>
            )}
            {currentStep === steps.length - 1 && (
              <Button 
                type="primary" 
                onClick={handleComplete}
                size="middle"
              >
                Complete
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default UserHealthProfileForm;