exports.Conditions = {
    condition_id: null,
    condition_name: ''
};

exports.Medications = {
    medication_id: null,
    medication_name: ''
};

exports.DietType = {
    diet_type_id: null,
    diet_type: ''
};

exports.PhysicalActivityLevel = {
    pal_id: null,
    activity_level: ''
};

exports.AlcoholConsumption = {
    alcohol_consumption_id: null,
    consumption_level: ''
};

exports.UserPersonalData = {
    patient_id: null,
    name: '',
    age: 0,
    gender: '',
    date_of_visit: null,
    previous_visits: 0,
    diet_type_id: null,
    physical_activity_level_id: null,
    is_smoker: 1,
    alcohol_consumption_id: null,
    blood_pressure: '',
    weight_kg: 0,
    height_cm: 0,
    bmi: 0.0
};

exports.InterstitialFluidElement = {
    element_id: null,
    element_name: '',
    upper_limit: 0,
    lower_limit: 0,
    upper_critical_limit: 0,
    lower_critical_limit: 0
};

exports.DeviceDataQuery = {
    query_id: null,
    date_logged: null,
    recorded_value: 0,
    element_id: null
};

exports.AccountLevel = {
    level_id: null,
    level_value: ''
};

exports.Account = {
    account_id: null,
    email: '',
    password: '',
    level_id: 1,
    user_data_id: null,
    first_name: '',
    last_name: ''
};
