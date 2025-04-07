import numpy as np
import pandas as pd
import datetime
import argparse
from pathlib import Path

def generate_biomarker_data(
    duration_seconds=60,
    sample_rate=50,
    output_file="biomarker_data.csv",
    add_noise=True,
    add_trend=True
):
    """
    Generate synthetic time series data for biomarkers at specified sample rate.
    
    Parameters:
    -----------
    duration_seconds : int
        Duration of the time series in seconds
    sample_rate : int
        Number of samples per second (Hz)
    output_file : str
        Path to save the CSV output
    add_noise : bool
        Whether to add random noise to the signal
    add_trend : bool
        Whether to add slow-varying trends to simulate real biological changes
    """
    # Calculate total number of data points
    total_samples = duration_seconds * sample_rate
    
    # Generate timestamps
    start_time = datetime.datetime.now()
    timestamps = [start_time + datetime.timedelta(milliseconds=i*(1000/sample_rate)) 
                  for i in range(total_samples)]
    
    # Normal ranges for biomarkers in appropriate units
    # Cortisol: 5-25 μg/dL in blood (morning peak, afternoon trough)
    # Lactate: 0.5-2.2 mmol/L at rest, can rise to 20+ during intense exercise
    # Uric acid: 3.5-7.2 mg/dL in blood
    # C-Reactive Protein (CRP): 0.1-10 mg/L (inflammation marker, can rise significantly during inflammation)
    # Interleukin-6 (IL-6): 0-10 pg/mL (inflammatory cytokine, elevated during inflammation)
    # Body temperature: 36.5-37.5 °C (normal range)
    # Heart rate: 60-100 BPM (normal resting range for adults)
    # Blood oxygen (SpO2): 95-100% (normal range)
    
    # Base values (midpoint of normal ranges)
    cortisol_base = 15.0        # μg/dL
    lactate_base = 1.3          # mmol/L
    uric_acid_base = 5.3        # mg/dL
    crp_base = 1.0              # mg/L
    il6_base = 2.0              # pg/mL
    body_temp_base = 37.0       # °C
    heart_rate_base = 75        # BPM
    blood_oxygen_base = 97      # %
    
    # Generate base signals with natural variation
    t = np.linspace(0, duration_seconds, total_samples)
    
    # Cortisol has diurnal rhythm (higher in morning, lower in evening)
    # Simulating small part of this pattern
    cortisol = cortisol_base + 5 * np.sin(2 * np.pi * t / (24 * 60 * 60))
    
    # Lactate can spike during activity
    lactate = lactate_base + 0.3 * np.sin(2 * np.pi * t / 60)
    
    # Uric acid tends to be more stable but can vary with meals
    uric_acid = uric_acid_base + 0.5 * np.sin(2 * np.pi * t / 180)
    
    # CRP varies slowly and can spike during inflammation
    crp = crp_base + 0.4 * np.sin(2 * np.pi * t / 240)
    
    # IL-6 has diurnal variation with peaks during inflammatory responses
    il6 = il6_base + 1.2 * np.sin(2 * np.pi * t / 120)
    
    # Body temperature has slight diurnal variation
    body_temp = body_temp_base + 0.2 * np.sin(2 * np.pi * t / (12 * 60 * 60))
    
    # Heart rate varies with activity and stress
    heart_rate = heart_rate_base + 5 * np.sin(2 * np.pi * t / 30)
    
    # Blood oxygen has slight variations but stays within tight range
    blood_oxygen = blood_oxygen_base + 0.5 * np.sin(2 * np.pi * t / 45)
    
    # Add trend if requested
    if add_trend:
        # Slow-varying trends that might represent real biological changes
        cortisol_trend = 2 * np.sin(2 * np.pi * t / (duration_seconds * 2))
        lactate_trend = 0.5 * np.sin(2 * np.pi * t / duration_seconds)
        uric_acid_trend = 0.3 * np.sin(2 * np.pi * t / (duration_seconds * 3))
        crp_trend = 1.5 * np.sin(2 * np.pi * t / (duration_seconds * 1.5))
        il6_trend = 2 * np.sin(2 * np.pi * t / (duration_seconds * 2.5))
        body_temp_trend = 0.1 * np.sin(2 * np.pi * t / (duration_seconds * 4))
        heart_rate_trend = 8 * np.sin(2 * np.pi * t / (duration_seconds * 1.2))
        blood_oxygen_trend = 0.8 * np.sin(2 * np.pi * t / (duration_seconds * 2.2))
        
        cortisol += cortisol_trend
        lactate += lactate_trend
        uric_acid += uric_acid_trend
        crp += crp_trend
        il6 += il6_trend
        body_temp += body_temp_trend
        heart_rate += heart_rate_trend
        blood_oxygen += blood_oxygen_trend
    
    # Add noise if requested
    if add_noise:
        # Realistic noise levels for each biomarker
        cortisol_noise = np.random.normal(0, 0.5, total_samples)
        lactate_noise = np.random.normal(0, 0.1, total_samples)
        uric_acid_noise = np.random.normal(0, 0.2, total_samples)
        crp_noise = np.random.normal(0, 0.3, total_samples)
        il6_noise = np.random.normal(0, 0.4, total_samples)
        body_temp_noise = np.random.normal(0, 0.05, total_samples)
        heart_rate_noise = np.random.normal(0, 1.0, total_samples)
        blood_oxygen_noise = np.random.normal(0, 0.2, total_samples)
        
        cortisol += cortisol_noise
        lactate += lactate_noise
        uric_acid += uric_acid_noise
        crp += crp_noise
        il6 += il6_noise
        body_temp += body_temp_noise
        heart_rate += heart_rate_noise
        blood_oxygen += blood_oxygen_noise
    
    # Ensure values stay within physiological ranges
    cortisol = np.clip(cortisol, 5.0, 25.0)
    lactate = np.clip(lactate, 0.5, 22.0)
    uric_acid = np.clip(uric_acid, 3.5, 7.2)
    crp = np.clip(crp, 0.1, 10.0)
    il6 = np.clip(il6, 0.0, 10.0)
    body_temp = np.clip(body_temp, 36.5, 37.5)
    heart_rate = np.clip(heart_rate, 60, 100)
    blood_oxygen = np.clip(blood_oxygen, 95, 100)
    
    # Create DataFrame
    df = pd.DataFrame({
        'timestamp': timestamps,
        'cortisol_ug_dL': cortisol,
        'lactate_mmol_L': lactate,
        'uric_acid_mg_dL': uric_acid,
        'crp_mg_L': crp,
        'il6_pg_mL': il6,
        'body_temp_C': body_temp,
        'heart_rate_BPM': heart_rate,
        'blood_oxygen_pct': blood_oxygen
    })
    
    # Format timestamp as string
    df['timestamp'] = df['timestamp'].dt.strftime('%Y-%m-%d %H:%M:%S.%f')
    
    # Save to CSV
    df.to_csv(output_file, index=False)
    print(f"Generated {total_samples} samples ({duration_seconds} seconds at {sample_rate}Hz)")
    print(f"Data saved to {output_file}")
    
    return df

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Generate synthetic biomarker time series data')
    parser.add_argument('--duration', type=int, default=60, 
                        help='Duration in seconds (default: 60)')
    parser.add_argument('--rate', type=int, default=50,
                        help='Sample rate in Hz (default: 50)')
    parser.add_argument('--output', type=str, default='biomarker_data.csv',
                        help='Output CSV file path (default: biomarker_data.csv)')
    parser.add_argument('--no-noise', action='store_false', dest='noise',
                        help='Disable random noise in the signal')
    parser.add_argument('--no-trend', action='store_false', dest='trend',
                        help='Disable biological trends in the signal')
    
    args = parser.parse_args()
    
    # Create output directory if it doesn't exist
    output_path = Path(args.output)
    output_dir = output_path.parent
    if output_dir and not output_dir.exists():
        output_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate data
    generate_biomarker_data(
        duration_seconds=args.duration,
        sample_rate=args.rate,
        output_file=args.output,
        add_noise=args.noise,
        add_trend=args.trend
    )