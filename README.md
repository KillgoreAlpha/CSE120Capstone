# X10e Health Monitoring System

The X10e Health Monitoring System is a full-stack application that provides real-time biomarker data monitoring with an AI-powered chat interface. The system helps users track and understand their health metrics through intuitive visualizations and personalized insights.

## System Components

1. **Backend**: Node.js Express server with WebSocket support and SQLite database
2. **Frontend**: React TypeScript application with Chart.js for real-time data visualization
3. **Data Generation**: Python script for synthetic biomarker data generation and streaming
4. **AI Integration**: AWS Bedrock for natural language interactions about health data

## Biomarkers Tracked

The system monitors several key health biomarkers in real-time:

- **Cortisol** (μg/dL): Stress hormone that regulates metabolism and immune response
- **Lactate** (mmol/L): Produced during intense exercise or when oxygen is limited
- **Uric Acid** (mg/dL): Metabolic waste product associated with gout and kidney function
- **CRP** (mg/L): C-reactive protein, a marker of inflammation
- **IL-6** (pg/mL): Interleukin-6, an inflammatory cytokine
- **Body Temperature** (°C): Core body temperature
- **Heart Rate** (BPM): Heart beats per minute
- **Blood Oxygen** (%): Oxygen saturation level in blood

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

For AWS integration, you'll need to set up additional environment variables:
```
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AGENT_ID=your_bedrock_agent_id
AGENT_ALIAS_ID=your_bedrock_agent_alias_id
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
2. Create a user health profile to get personalized insights
3. Navigate between the different views:
   - **Dashboard**: Overview of your health metrics
   - **Live Data**: Real-time biomarker measurements with interactive graphs
   - **Research Data**: (Admin only) Access to research papers and data
4. Use the Chat interface to ask questions about your health data

## Data Streaming Options

The biomarker data streaming supports various options:

```bash
cd backend
python synthesize-data.py stream --help
```

Common options:
- `--stream-interval`: Time between data points (default: 0.2 seconds)
- `--no-noise`: Disable random noise in the data
- `--no-trend`: Disable biological trends in the data
- `--duration`: Set a time limit for data streaming (in hours)

Example with custom interval:
```bash
python synthesize-data.py stream --stream-interval 0.5 --duration 1
```

## Batch Data Generation

To generate a batch of data without streaming:

```bash
cd backend
python synthesize-data.py batch --duration 60 --rate 10
```

This will create a CSV file with synthetic biomarker data.

## Research Data Scraping

The system includes a web scraper for collecting biomarker research papers:

```bash
cd backend
python webScraper.py
```

This script queries PubMed and arXiv for relevant papers and processes them for the knowledge base.

## Architecture

### Backend

- **Express.js server** with REST API endpoints and WebSocket server for real-time data streaming
- **SQLite database** for storing biomarker readings and health conditions
- **AWS Bedrock integration** for AI chat functionality

Key components:
- `server.js`: Main server with API endpoints and WebSocket implementation
- `synthesize-data.py`: Python script for generating synthetic biomarker data
- `webScraper.py`: Python script for collecting biomarker research papers

### Frontend

- **React** with **TypeScript** and **Vite** for fast development
- **Chart.js** with React wrapper for real-time data visualization
- **Ant Design** for UI components
- **Axios** for API calls
- **WebSocket** for real-time data updates

Key components:
- `App.tsx`: Main application layout and routing
- `HealthDashboard.tsx`: Comprehensive health metrics dashboard
- `LiveDataGraph.tsx`: Component for displaying real-time biomarker data
- `ChatPanel.tsx`: AI assistant interface for health inquiries

### Data Flow

1. Python script generates synthetic biomarker data
2. Data is sent to the backend via REST API or directly via WebSocket
3. Backend stores data in SQLite database
4. Frontend fetches and displays data in real-time using WebSockets
5. Chat interface connects to AWS Bedrock for AI-powered health insights

## Key Features

- **Real-time Monitoring**: Live visualization of biomarker data as it's generated
- **Personalized Insights**: AI-powered chat assistant for health-related queries
- **Comprehensive Dashboard**: Overview of all health metrics with trend analysis
- **User Health Profiles**: Store and manage personalized health information
- **Research Integration**: (Admin only) Access to biomarker research knowledge base
- **Responsive Design**: Optimized for both desktop and mobile devices

## Documentation

- `README.md`: This file with overview and setup instructions
- `SIGNATURES.md`: Detailed API and function documentation
- `CONTRIBUTING.md`: Guidelines for contributing to the project