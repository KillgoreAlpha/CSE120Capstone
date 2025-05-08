import numpy as np
import pandas as pd
import datetime
import argparse
import requests
import time
import json
import socket
import threading
import os
from pathlib import Path

def generate_biomarker_data_batch(
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

def generate_single_reading(
    base_time=None,
    add_noise=True,
    add_small_trend=True,
    time_offset=0
):
    """
    Generate a single biomarker reading.
    
    Parameters:
    -----------
    base_time : datetime
        Base timestamp for the reading
    add_noise : bool
        Whether to add random noise to the signal
    add_small_trend : bool
        Whether to add slow-varying trend component
    time_offset : float
        Time offset in seconds from base_time
    
    Returns:
    --------
    Dict with biomarker readings
    """
    if base_time is None:
        base_time = datetime.datetime.now()
        
    timestamp = base_time + datetime.timedelta(seconds=time_offset)
    
    # Base values (midpoint of normal ranges)
    cortisol_base = 15.0        # μg/dL
    lactate_base = 1.3          # mmol/L
    uric_acid_base = 5.3        # mg/dL
    crp_base = 1.0              # mg/L
    il6_base = 1.5              # pg/mL
    body_temp_base = 37.0       # °C
    heart_rate_base = 75        # BPM
    blood_oxygen_base = 97      # %
    
    # Time of day effects
    hour_of_day = timestamp.hour + timestamp.minute / 60
    
    # Cortisol has diurnal rhythm (higher in morning, lower in evening)
    day_progress = hour_of_day / 24  # 0 to 1 throughout the day
    cortisol = cortisol_base + 5 * np.sin(2 * np.pi * day_progress)
    
    # Other biomarkers with slight time variations
    t = time_offset
    lactate = lactate_base + 0.3 * np.sin(2 * np.pi * t / 60)
    uric_acid = uric_acid_base + 0.5 * np.sin(2 * np.pi * t / 180)
    crp = crp_base + 0.4 * np.sin(2 * np.pi * t / 240)
    il6 = il6_base + 1.2 * np.sin(2 * np.pi * t / 120)
    body_temp = body_temp_base + 0.2 * np.sin(2 * np.pi * day_progress)
    heart_rate = heart_rate_base + 5 * np.sin(2 * np.pi * t / 30)
    blood_oxygen = blood_oxygen_base + 0.5 * np.sin(2 * np.pi * t / 45)
    
    # Add small trend if requested
    if add_small_trend:
        # Very small trends that simulate short-term physiological changes
        cortisol += 0.2 * np.sin(2 * np.pi * t / 300)
        lactate += 0.05 * np.sin(2 * np.pi * t / 240)
        uric_acid += 0.03 * np.sin(2 * np.pi * t / 450)
        crp += 0.1 * np.sin(2 * np.pi * t / 600)
        il6 += 0.2 * np.sin(2 * np.pi * t / 500)
        body_temp += 0.01 * np.sin(2 * np.pi * t / 720)
        heart_rate += 2 * np.sin(2 * np.pi * t / 180)
        blood_oxygen += 0.2 * np.sin(2 * np.pi * t / 360)
    
    # Add noise if requested
    if add_noise:
        cortisol += np.random.normal(0, 0.3)
        lactate += np.random.normal(0, 0.05)
        uric_acid += np.random.normal(0, 0.1)
        crp += np.random.normal(0, 0.1)
        il6 += np.random.normal(0, 0.15)
        body_temp += np.random.normal(0, 0.03)
        heart_rate += np.random.normal(0, 0.8)
        blood_oxygen += np.random.normal(0, 0.1)
    
    # Ensure values stay within physiological ranges
    cortisol = np.clip(cortisol, 5.0, 25.0)
    lactate = np.clip(lactate, 0.5, 22.0)
    uric_acid = np.clip(uric_acid, 3.5, 7.2)
    crp = np.clip(crp, 0.1, 10.0)
    il6 = np.clip(il6, 0.0, 10.0)
    body_temp = np.clip(body_temp, 36.5, 37.5)
    heart_rate = np.clip(heart_rate, 60, 100)
    blood_oxygen = np.clip(blood_oxygen, 95, 100)
    
    return {
        'timestamp': timestamp.strftime('%Y-%m-%d %H:%M:%S.%f'),
        'cortisol_ug_dL': cortisol,
        'lactate_mmol_L': lactate,
        'uric_acid_mg_dL': uric_acid,
        'crp_mg_L': crp,
        'il6_pg_mL': il6,
        'body_temp_C': body_temp,
        'heart_rate_BPM': heart_rate,
        'blood_oxygen_pct': blood_oxygen
    }

def stream_biomarker_data(
    server_url='http://localhost:3000/readings',
    stream_interval=0.2,  # Stream to server every 0.2 seconds (5Hz) - increased from 0.5s
    sample_rate=50,       # Generate data at 50Hz
    duration_hours=None,  # None means run indefinitely
    add_noise=True,
    add_trend=True,
    verbose=True,
    websocket_port=None,
    test_mode=False,
    save_csv=True,
    output_file='biomarker_data.csv',  # Default output file changed to be consistent
    csv_update_interval=100,  # Update CSV after 100 samples (every 2 seconds at 50Hz)
    batch_duration_seconds=60,
    batch_sample_rate=50,     # Batch generation at 50Hz
    batch_output_file=None
):
    """
    Stream biomarker data to server in real-time and optionally save to CSV.
    
    Parameters:
    -----------
    server_url : str
        URL to send data to
    stream_interval : float
        Time between streaming readings to server (default: 0.5 seconds - 2Hz)
    sample_rate : int
        Rate at which to generate and save data (default: 50Hz)
    duration_hours : float or None
        Total duration to stream (None for indefinite)
    add_noise : bool
        Whether to add random noise to signals
    add_trend : bool
        Whether to add slow-varying trends
    verbose : bool
        Whether to print status information
    websocket_port : int or None
        Port for WebSocket server (None to disable)
    test_mode : bool
        If True, don't actually send data to server
    save_csv : bool
        Whether to save the streamed data to a CSV file
    output_file : str
        Path to save the streaming CSV output
    csv_update_interval : int
        Number of readings before updating the CSV file
    batch_duration_seconds : int
        Duration in seconds for batch generation
    batch_sample_rate : int
        Sample rate in Hz for batch generation
    batch_output_file : str
        Path to save the batch CSV output
    """
    if verbose:
        print(f"Starting biomarker data streaming to {server_url}")
        print(f"Data generation rate: {sample_rate}Hz")
        print(f"Server streaming rate: Every {stream_interval} seconds ({1/stream_interval}Hz)")
        if duration_hours:
            print(f"Total duration: {duration_hours} hours")
        else:
            print("Streaming indefinitely (press Ctrl+C to stop)")
        if save_csv:
            print(f"Saving generated data to CSV: {output_file}")
            print(f"CSV update frequency: Every {csv_update_interval} samples")
        
        # Generate initial batch file if batch_output_file is specified
        if batch_output_file:
            # Warn if batch output is same as main output
            if batch_output_file == output_file:
                print(f"Warning: Batch output file is the same as streaming output file ({output_file}).")
                print("One will overwrite the other. Consider using different output files.")
            else:
                print(f"Generating initial batch data to: {batch_output_file}")
                print(f"Batch settings: {batch_duration_seconds} seconds at {batch_sample_rate}Hz")
        
    start_time = datetime.datetime.now()
    reading_count = 0
    base_time = start_time
    time_offset = 0.0
    
    # We don't need a separate WebSocket server since the main Node.js server
    # already has WebSocket support. Instead, we'll just use the REST API endpoint
    # which will broadcast data to all WebSocket clients automatically.
    
    ws_thread = None
    ws_clients = []
    if websocket_port:
        print(f"Note: Custom WebSocket server on port {websocket_port} is not needed.")
        print("Data will be broadcast through the main server's WebSocket implementation.")
    
    # Create a list to store all readings for CSV export
    all_readings = []
    
    # Create output directories if they don't exist
    if save_csv:
        output_path = Path(output_file)
        output_dir = output_path.parent
        if output_dir and not output_dir.exists():
            output_dir.mkdir(parents=True, exist_ok=True)
            
    if batch_output_file:
        batch_path = Path(batch_output_file)
        batch_dir = batch_path.parent
        if batch_dir and not batch_dir.exists():
            batch_dir.mkdir(parents=True, exist_ok=True)
            
    # Generate initial batch file if requested
    if batch_output_file:
        generate_biomarker_data_batch(
            duration_seconds=batch_duration_seconds,
            sample_rate=batch_sample_rate,
            output_file=batch_output_file,
            add_noise=add_noise,
            add_trend=add_trend
        )
    
    try:
        while True:
            current_time = datetime.datetime.now()
            
            # Check if duration exceeded
            if duration_hours is not None:
                elapsed_hours = (current_time - start_time).total_seconds() / 3600
                if elapsed_hours >= duration_hours:
                    if verbose:
                        print(f"Reached specified duration of {duration_hours} hours")
                    break
            
            # Generate a single reading
            reading = generate_single_reading(
                base_time=base_time,
                add_noise=add_noise,
                add_small_trend=add_trend,
                time_offset=time_offset
            )
            
            # Store reading for CSV export
            if save_csv:
                all_readings.append(reading)
            
            # Send data to server
            if not test_mode:
                try:
                    response = requests.post(server_url, json=reading)
                    if response.status_code != 200 and response.status_code != 201:
                        if verbose:
                            print(f"Error sending data: {response.status_code} - {response.text}")
                except Exception as e:
                    if verbose:
                        print(f"Error sending data to server: {e}")
            
            # Print progress
            reading_count += 1
            if verbose and reading_count % 10 == 0:
                print(f"Sent {reading_count} readings to server")
            
            # Periodically update CSV file
            if save_csv and reading_count % csv_update_interval == 0:
                df = pd.DataFrame(all_readings)
                df.to_csv(output_file, index=False)
                if verbose:
                    print(f"Updated CSV file with {len(all_readings)} readings")
                
            # Control timing
            time_offset += stream_interval
            sleep_time = stream_interval - ((datetime.datetime.now() - current_time).total_seconds())
            if sleep_time > 0:
                time.sleep(sleep_time)
                
    except KeyboardInterrupt:
        if verbose:
            print("\nStreaming stopped by user")
    finally:
        # Save final CSV
        if save_csv and all_readings:
            df = pd.DataFrame(all_readings)
            df.to_csv(output_file, index=False)
            if verbose:
                print(f"Saved final CSV with {len(all_readings)} readings to {output_file}")
        
        if verbose:
            print(f"Sent a total of {reading_count} readings over {(datetime.datetime.now() - start_time).total_seconds() / 60:.2f} minutes")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Generate synthetic biomarker time series data')
    
    # Main command group
    subparsers = parser.add_subparsers(dest='command', help='Command mode')
    
    # Batch generation command
    batch_parser = subparsers.add_parser('batch', help='Generate a batch of data')
    batch_parser.add_argument('--duration', type=int, default=60, 
                          help='Duration in seconds (default: 60)')
    batch_parser.add_argument('--rate', type=int, default=50,
                          help='Sample rate in Hz (default: 50)')
    batch_parser.add_argument('--output', type=str, default='biomarker_data.csv',
                          help='Output CSV file path (default: biomarker_data.csv)')
    batch_parser.add_argument('--no-noise', action='store_false', dest='noise',
                          help='Disable random noise in the signal')
    batch_parser.add_argument('--no-trend', action='store_false', dest='trend',
                          help='Disable biological trends in the signal')
    
    # Streaming command
    stream_parser = subparsers.add_parser('stream', help='Stream data to server in real-time')
    stream_parser.add_argument('--server', type=str, default='http://localhost:3000/readings',
                           help='Server URL to send data to (default: http://localhost:3000/readings)')
    stream_parser.add_argument('--stream-interval', type=float, default=0.2,
                           help='Interval between streaming to server in seconds (default: 0.2 - five times per second)')
    stream_parser.add_argument('--sample-rate', type=int, default=50,
                           help='Rate at which to generate and save data in Hz (default: 50Hz)')
    stream_parser.add_argument('--duration', type=float, default=None,
                           help='Duration to stream in hours (default: indefinite)')
    stream_parser.add_argument('--no-noise', action='store_false', dest='noise',
                           help='Disable random noise in the signal')
    stream_parser.add_argument('--no-trend', action='store_false', dest='trend',
                           help='Disable biological trends in the signal')
    stream_parser.add_argument('--quiet', action='store_false', dest='verbose',
                           help='Disable verbose output')
    stream_parser.add_argument('--websocket', type=int, default=None,
                           help='Enable WebSocket server on specified port')
    stream_parser.add_argument('--test', action='store_true', dest='test_mode',
                           help='Test mode - don\'t actually send data to server')
    stream_parser.add_argument('--no-csv', action='store_false', dest='save_csv',
                           help='Disable saving generated data to CSV')
    stream_parser.add_argument('--output', type=str, default='biomarker_data.csv',
                           help='Output CSV file path (default: biomarker_data.csv)')
    stream_parser.add_argument('--csv-update-interval', type=int, default=100,
                           help='Number of readings before updating the CSV file (default: 100)')
    
    # Additional batch generation parameters for streaming mode
    stream_parser.add_argument('--batch-generate', action='store_true',
                           help='Also generate a batch file when streaming')
    stream_parser.add_argument('--batch-output', type=str, default=None,
                           help='Output file for batch generation (default: biomarker_batch.csv)')
    stream_parser.add_argument('--batch-duration', type=int, default=60,
                           help='Duration in seconds for batch generation (default: 60)')
    stream_parser.add_argument('--batch-rate', type=int, default=50,
                           help='Sample rate in Hz for batch generation (default: 50Hz)')
    
    args = parser.parse_args()
    
    # If no command is provided, default to batch mode for backward compatibility
    if args.command is None or args.command == 'batch':
        # Create output directory if it doesn't exist
        output_path = Path(args.output if hasattr(args, 'output') else 'biomarker_data.csv')
        output_dir = output_path.parent
        if output_dir and not output_dir.exists():
            output_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate data batch
        generate_biomarker_data_batch(
            duration_seconds=args.duration if hasattr(args, 'duration') else 60,
            sample_rate=args.rate if hasattr(args, 'rate') else 50,
            output_file=args.output if hasattr(args, 'output') else 'biomarker_data.csv',
            add_noise=args.noise if hasattr(args, 'noise') else True,
            add_trend=args.trend if hasattr(args, 'trend') else True
        )
    elif args.command == 'stream':
        # If batch-generate is requested but no output specified, set a default
        if args.batch_generate and not args.batch_output:
            args.batch_output = 'biomarker_batch.csv'
            
        # Stream data to server
        stream_biomarker_data(
            server_url=args.server,
            stream_interval=args.stream_interval,
            sample_rate=args.sample_rate,
            duration_hours=args.duration,  # None means run indefinitely
            add_noise=args.noise,
            add_trend=args.trend,
            verbose=args.verbose,
            websocket_port=args.websocket,
            test_mode=args.test_mode,
            save_csv=args.save_csv,
            output_file=args.output,
            csv_update_interval=args.csv_update_interval,
            batch_duration_seconds=args.batch_duration if args.batch_generate else None,
            batch_sample_rate=args.batch_rate,
            batch_output_file=args.batch_output
        )