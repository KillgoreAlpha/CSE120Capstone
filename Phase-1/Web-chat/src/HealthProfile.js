import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { FiRefreshCw } from "react-icons/fi"
import "./HealthProfile.scss";

const HealthProfile = () => {
  const navigate = useNavigate();
  const [healthProfile, setHealthProfile] = useState(() => {
    const weight = localStorage.getItem("weight") || "";
    const height = localStorage.getItem("height") || "";
    const age = localStorage.getItem("age") || "";


    const otherCondition = localStorage.getItem("otherCondition") || "";
    const healthConditions =
      JSON.parse(localStorage.getItem("healthConditions")) || [];
  
    return { weight, height, age, healthConditions, otherCondition};
  });

  const [submittedProfile, setSubmittedProfile] = useState(null);
  const [deviceData, setDeviceData] = useState({
    summary: "",
  });

  const [conditionOptions, setConditionOptions] = useState([]);
  const [showOtherInput, setShowOtherInput] = useState(false); // Toggle for "Other" input

  useEffect(() => {
    const fetchedConditions = [
      "Diabetes",
      "Hypertension",
      "Asthma",
      "Heart Disease",
      "Arthritis",
      "Obesity",
      "Cancer",
      "Chronic Kidney Disease",
      "Depression",
      "Sleep Apnea",
      "Chronic Migraine",
      "Thyroid Disease",
      "Multiple Sclerosis",
    ];

    setConditionOptions(fetchedConditions);

    // Load stored values
    const storedProfile = {
      weight: localStorage.getItem("weight") || "",
      height: localStorage.getItem("height") || "",
      age: localStorage.getItem("age") || "",
      healthConditions:
        JSON.parse(localStorage.getItem("healthConditions")) || [],
      otherCondition: localStorage.getItem("otherCondition") || "",
    };
    
    const validConditions = storedProfile.healthConditions.filter((condition) =>
      fetchedConditions.includes(condition)
    );

    setHealthProfile({
      ...storedProfile,
      healthConditions: validConditions,
    });

    const storedSummary = localStorage.getItem("summary") || "";
    setDeviceData({ summary: storedSummary });
  }, []);
  
  useEffect(() => {
  
    // Update localStorage whenever specific fields of healthProfile change
    localStorage.setItem("weight", healthProfile.weight);
    localStorage.setItem("height", healthProfile.height);
    localStorage.setItem("age", healthProfile.age);
    console.log("INITIAL" + localStorage.getItem("otherCondition"))
    localStorage.setItem("otherCondition",healthProfile.otherCondition)
    console.log("AFTER" + localStorage.getItem("otherCondition"))
    const allConditions = healthProfile.otherCondition
    ? [...healthProfile.healthConditions, healthProfile.otherCondition]
    : healthProfile.healthConditions;
    localStorage.setItem(
      "healthConditions",
      JSON.stringify(allConditions)
    );

    

  }, [healthProfile.weight, healthProfile.height, healthProfile.age, healthProfile.healthConditions,healthProfile.otherCondition]);

  // Update the profile preview when data is submitted
  useEffect(() => {
    setSubmittedProfile({ ...healthProfile });
  }, [healthProfile]);

  const handleUpdateDevice = () => {
    const apiUrl = `http://localhost:5000/health-profile`;

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deviceData),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.json();
      })
      .then((data) => {
        setDeviceData({ summary: data.summary });
        localStorage.setItem("summary", data.summary);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        alert("Failed to update device data. Please try again.");
      });
  };

  const handleChangeProfile = (e) => {
    const { name, value } = e.target;
  
    setHealthProfile((prev) => ({
      ...prev,
      [name]: value, // This will properly update "otherCondition"
    }));
    
  };

  const handleCheckboxChange = (condition) => {
    
    setHealthProfile((prev) => {
      const conditions = prev.healthConditions.includes(condition)
        ? prev.healthConditions.filter((c) => c !== condition)
        : [...prev.healthConditions, condition];
      return { ...prev, healthConditions: conditions };
    });
    
  };

  const handleGoToChatbox = () => {
    navigate("/chat");
  };

  const handleOtherCheckboxChange = () => {
    
    setShowOtherInput((prev) => !prev);
    if (!showOtherInput) {
      setHealthProfile((prev) => ({ ...prev, otherCondition: "" }));
    }
  };

  return (
    <div className="health-profile-page">
      <div className="health-profile-container">
        {/* Health Profile Section */}
        <div className="health-profile">
          <div className="health-section">
            <h1>Health Profile</h1>
            <div className="input-container">
              <label>Weight (kg):</label>
              <input
                type="number"
                name="weight"
                value={healthProfile.weight}
                onChange={handleChangeProfile}
              />
            </div>
            <div className="input-container">
              <label>Height (cm):</label>
              <input
                type="number"
                name="height"
                value={healthProfile.height}
                onChange={handleChangeProfile}
              />
            </div>
            <div className="input-container">
              <label>Age:</label>
              <input
                type="number"
                name="age"
                value={healthProfile.age}
                onChange={handleChangeProfile}
              />
            </div>
            <div className="input-container">
              <label>Health Conditions:</label>
              <div className="checkbox-container">
                {/* Left section for the first half of the conditions */}
                <div className="checkbox-left">
                  {conditionOptions.slice(0, Math.ceil(conditionOptions.length / 2)).map((condition) => (
                    <div key={condition} className="checkbox-item">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={healthProfile.healthConditions.includes(condition)}
                          onChange={() => handleCheckboxChange(condition)}
                        />
                        {condition}
                      </label>
                    </div>
                  ))}
                </div>

                {/* Right section for the second half of the conditions */}
                <div className="checkbox-right">
                  {conditionOptions.slice(Math.ceil(conditionOptions.length / 2)).map((condition) => (
                    <div key={condition} className="checkbox-item">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={healthProfile.healthConditions.includes(condition)}
                          onChange={() => handleCheckboxChange(condition)}
                        />
                        {condition}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              {/* "Other" checkbox */}
              <div className="checkbox-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showOtherInput}
                    onChange={handleOtherCheckboxChange}
                  />
                  Other (Specify)
                </label>
                {showOtherInput && (
                  <div className="other-condition-container">
                    <input
                      type="text"
                      name="otherCondition"
                      value={healthProfile.otherCondition}
                      onChange={handleChangeProfile}
                      placeholder="Enter custom condition"
                    />
                  </div>
                )}
              </div>
            </div>
            
          </div>

          {/* Current Information Section */}
          <div className="current-info-section">
            <h1>Current Information</h1>
            <p><strong>Weight:</strong> {submittedProfile?.weight || "N/A"} kg</p>
            <p><strong>Height:</strong> {submittedProfile?.height || "N/A"} cm</p>
            <p><strong>Age:</strong> {submittedProfile?.age || "N/A"}</p>
            <p>
              <strong>Health Conditions:</strong>{" "}
              {submittedProfile?.healthConditions.join(", ") || "None"}
              {submittedProfile?.otherCondition && `, ${submittedProfile.otherCondition}`}
            </p>
          </div>
        </div>

        {/* Device Data Section */}
        <div className="device-data-summary">
          <div className="health-section">
            
            <h1>Device Data Summary</h1>
                
            <div className="summary-display">
            <FiRefreshCw
              size={24} // Size of the icon
              onClick={handleUpdateDevice}
            />
              {deviceData.summary ? (
                <ReactMarkdown>{deviceData.summary}</ReactMarkdown>
              ) : (
                "No summary available"
              )}
            </div>
            
          </div>
        </div>

        <div className="go-to-chatbox-button">
          <button onClick={handleGoToChatbox}>Back to Chatbox</button>
        </div>
      </div>
    </div>
  );
};

export default HealthProfile;
