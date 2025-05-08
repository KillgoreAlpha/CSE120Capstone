# X10e Health Monitoring System

The project consists of a frontend and backend, with a real-time biomarker data generation system. The application provides a chat interface to interact with health data and a live dashboard for biomarker visualization.

## Project Setup

First, install dependencies for all components:

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Environment Setup

Create a `.env` file in the root directory with:

```
VITE_REDIRECT_URI=http://localhost:5173
```

## Running the Application

### Option 1: Run Everything with One Command

To start the backend, frontend, and data streaming at once:

```bash
npm run dev:all
```

### Option 2: Run Components Separately

#### Running the Backend

In one terminal:

```bash
npm run backend
# or: cd backend && npm run dev
```

#### Running the Frontend

In another terminal:

```bash
npm run frontend
# or: cd frontend && npm run dev
```

#### Running the Data Streaming

In a third terminal:

```bash
npm run stream-data
# or: cd backend && npm run stream-data
```

## Using the Application

1. Access the frontend at http://localhost:5173
2. The Chat interface allows interaction with the AI assistant
3. The Live Biomarker Data tab shows real-time biomarker measurements

## Data Streaming Options

The biomarker data streaming supports various options:

```bash
cd backend
python synthesize-data.py stream --help
```

Common options:
- `--interval`: Time between data points (default: 1.0 seconds)
- `--no-noise`: Disable random noise in the data
- `--no-trend`: Disable biological trends in the data
- `--duration`: Set a time limit for data streaming (in hours)

Example with custom interval:
```bash
python synthesize-data.py stream --interval 0.5 --duration 1
```

## Batch Data Generation

To generate a batch of data without streaming:

```bash
cd backend
python synthesize-data.py batch --duration 60 --rate 10
```

This will create a CSV file with synthetic biomarker data.