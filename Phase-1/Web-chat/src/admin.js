import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './admin.scss';

function AdminPage() {
    const [sensitivity, setSensitivity] = useState(0.5);
    const [frequencyPenalty, setFrequencyPenalty] = useState(0.5);
    const [presencePenalty, setPresencePenalty] = useState(0.5);
    const [anomalyThreshold, setAnomalyThreshold] = useState(0.7);
    const [biomarkerThreshold, setBiomarkerThreshold] = useState(3);
    const [timeWindow, setTimeWindow] = useState('1 day');
    const [languageTuning, setLanguageTuning] = useState('');

    const [dateLogged, setDateLogged] = useState('');
    const [timeStamp, setTimeStamp] = useState('');
    const [recordedValue, setRecordedValue] = useState('');
    const [elementName, setElementName] = useState('');
    const [userId, setUserId] = useState('');

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    const navigate = useNavigate();

    const timeWindowOptions = ['Last 2 hours', '1 day', '1 week', '1 month'];

    useEffect(() => {
        fetch('http://localhost:5000/settings')
            .then((response) => response.json())
            .then((data) => {
                setSensitivity(data.sensitivity);
                setFrequencyPenalty(data.frequencyPenalty);
                setPresencePenalty(data.presencePenalty);
                setAnomalyThreshold(data.anomalyThreshold);
                setBiomarkerThreshold(data.biomarkerThreshold);
                setTimeWindow(data.timeWindow);
                setLanguageTuning(data.languageTuning);
            })
            .catch((error) => console.error('Error fetching settings:', error));

        fetch('http://localhost:5000/data_entries')
            .then((response) => response.json())
            .then((data) => {
                setData(data);
                setLoading(false);
            })
            .catch((error) => {
                setError(error.message);
                setLoading(false);
            });
    }, []);

    const handleSaveSettings = () => {
        const settings = {
            sensitivity,
            frequencyPenalty,
            presencePenalty,
            timeWindow,
            languageTuning,
        }
        ;

        fetch('http://localhost:5000/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings),
        })
            .then((response) => response.json())
            .then((data) => {
                console.log('Settings saved:', data);
                alert('Settings have been saved successfully.');
            })
            .catch((error) => console.error('Error saving settings:', error));
    };

    const handleAddDataEntry = () => {
        const dataEntry = {
            dateLogged,
            timeStamp,
            recordedValue,
            elementName,
            userId,
        };

        fetch('http://localhost:5000/data_entries', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataEntry),
        })
            .then((response) => response.json())
            .then((data) => {
                console.log('Data entry saved:', data);
                alert('Data entry has been saved successfully.');
                setDateLogged('');
                setTimeStamp('');
                setRecordedValue('');
                setElementName('');
                setUserId('');
            })
            .catch((error) => console.error('Error saving data entry:', error));
    };

    const logout = () => {
        alert('You have been logged out.');
    };

    const toChatBox = () => {
        navigate('/ChatBox');
    };

    const handleFileChange = (event) => {
        setSelectedFile(event.target.files);
    };

    return (
        <div className="admin-page">
            <h1>Admin Settings</h1>

            <div className="settings-group">
                <label htmlFor="pdfUpload">Upload Files to PineCone DB:</label>
                <br/>
                <input
                    type="file"
                    id="pdfUpload"
                    accept=".pdf"
                    multiple
                    onChange={handleFileChange}
                    className="file-input"
                />
            </div>

            <div className="settings-group">
                <label htmlFor="sensitivity">Top P:</label>
                <p style={{color: 'black', marginBottom: '5px'}}>
                    Controls the randomness of the generated text by selecting the smallest set of words whose
                    cumulative probability is greater than or equal to a specified probability `p`.
                </p>
                <input
                    type="range"
                    id="sensitivity"
                    min="0"
                    max="1"
                    step="0.01"
                    value={sensitivity}
                    onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                />
                <span>{sensitivity}</span>
            </div>

            <div className="settings-group">
                <label htmlFor="frequencyPenalty">Frequency Penalty:</label>
                <p style={{color: 'black', marginBottom: '5px'}}>
                    Controls the penalty for using frequent tokens in the generated text. Higher values decrease the
                    likelihood of repeating the same tokens.
                </p>
                <input
                    type="range"
                    id="frequencyPenalty"
                    min="0"
                    max="2"
                    step="0.01"
                    value={frequencyPenalty}
                    onChange={(e) => setFrequencyPenalty(parseFloat(e.target.value))}
                />
                <span>{frequencyPenalty}</span>
            </div>

            <div className="settings-group">
                <label htmlFor="presencePenalty">Presence Penalty:</label>
                <p style={{color: 'black', marginBottom: '5px'}}>
                    Controls the penalty for using new tokens in the generated text. Higher values increase the
                    likelihood of introducing new tokens.
                </p>
                <input
                    type="range"
                    id="presencePenalty"
                    min="0"
                    max="2"
                    step="0.01"
                    value={presencePenalty}
                    onChange={(e) => setPresencePenalty(parseFloat(e.target.value))}
                />
                <span>{presencePenalty}</span>
            </div>

            {/* Time window settings */}
            <div className="settings-group">
                <label htmlFor="timeWindow">Time Window for Data Analysis:</label>
                <select
                    id="timeWindow"
                    value={timeWindow}
                    onChange={(e) => setTimeWindow(e.target.value)}
                >
                    {timeWindowOptions.map((option, index) => (
                        <option key={index} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </div>

            {/* Language tuning */}
            <div className="settings-group">
                <label htmlFor="languageTuning">Fine-Tune Language Generation & Response Formatting:</label>
                <textarea
                    id="languageTuning"
                    value={languageTuning}
                    onChange={(e) => setLanguageTuning(e.target.value)}
                    rows="4"
                    placeholder="Enter fine-tuning parameters or notes..."
                ></textarea>
            </div>

            {/* Save settings button */}
            <button className="btn-logout" style={{marginBottom: '15px'}} onClick={handleSaveSettings}>
                Save Settings
            </button>

            <button className="btn-logout" onClick={logout}>
                Log Out
            </button>
            <button className="btn-logout" style={{marginTop: '15px'}} onClick={toChatBox}>
                Go to ChatBot
            </button>
        </div>
    );
}

export default AdminPage;