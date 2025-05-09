# Function Signatures Documentation

This document provides an overview of the key directories/files/classes/functions, their parameters, and return types as well as any class attributes in the X10e Health Monitoring System.

## Backend

### server.js
---

Core server implementation for the X10e Health Monitoring System with REST API and WebSocket support.

#### `async function checkUserInAdminGroup(username: string) -> boolean`
Checks if a user belongs to the administrators group in AWS Cognito.
- `username`: The user's unique identifier
- Returns: Boolean indicating admin status

#### `async function transcribeWithAWS(filePath: string, fileName: string) -> string`
Transcribes audio files using AWS Transcribe service.
- `filePath`: Path to the audio file
- `fileName`: Name to use when storing in S3
- Returns: Transcribed text

#### `async function filterWithLambda(query: string) -> object`
Applies content filter to user queries using AWS Lambda.
- `query`: The user query to be filtered
- Returns: Object with `allowed` flag and `reason` if rejected

#### `async function translateText(text: string, sourceLang: string, targetLang: string) -> string`
Translates text between languages using AWS Translate.
- `text`: The text to translate
- `sourceLang`: Source language code or name
- `targetLang`: Target language code or name
- Returns: Translated text

#### `function getBiomarkerDataInTimeframe(biomarker: string, startTime: string, endTime: string) -> Array<object>`
Retrieves biomarker data within a specified timeframe.
- `biomarker`: Name of the biomarker field
- `startTime`: Start timestamp
- `endTime`: End timestamp
- Returns: Array of biomarker readings

#### `function processCSVStream(csvFilePath: string, onHeader: Function, onData: Function, onComplete: Function, onError: Function) -> void`
Processes CSV data with callback functions for each stage.
- `csvFilePath`: Path to the CSV file
- `onHeader`: Callback for CSV headers
- `onData`: Callback for each data row
- `onComplete`: Callback when processing completes
- `onError`: Callback for errors

#### `async function importBiomarkerDataFromCSV() -> object`
Imports biomarker data from CSV file to database.
- Returns: Object with counts of processed and imported rows

#### `function seedHealthConditionsData() -> number`
Seeds initial health conditions data if table is empty.
- Returns: Count of inserted records

#### `function containsHealthDataKeywords(prompt: string) -> boolean`
Checks if a user prompt contains health data-related keywords.
- `prompt`: User query text
- Returns: Boolean indicating if health data keywords are present

#### `function getRecentHealthData() -> object`
Retrieves recent biomarker readings and calculates trends.
- Returns: Object with recent readings, averages, trends, readingCount, startDate, and endDate

#### `async function invokeBedrockAgent(prompt: string, sessionId: string, additionalContext: object = null) -> object`
Invokes AWS Bedrock agent to process user queries.
- `prompt`: User input text
- `sessionId`: Chat session identifier
- `additionalContext`: Optional health data to include in context (healthData, userHealthProfile)
- Returns: Object with session ID and completion text

#### `function generateSessionId() -> string`
Generates a unique session ID for chat interactions.
- Returns: Unique session identifier

#### `function getChatFilePath(userId: string, sessionId: string) -> string`
Gets file path for saving chat session.
- `userId`: User identifier
- `sessionId`: Chat session identifier
- Returns: File path for chat history

#### `function saveChatMessage(userId: string, sessionId: string, message: object) -> boolean`
Saves a chat message to persistent storage.
- `userId`: User identifier
- `sessionId`: Chat session identifier
- `message`: Message object to save
- Returns: Success status

#### `function getChatHistory(userId: string, sessionId: string) -> Array<object>`
Retrieves chat history for a specific session.
- `userId`: User identifier
- `sessionId`: Chat session identifier
- Returns: Array of chat messages

#### `function getUserChatSessions(userId: string) -> Array<object>`
Gets all chat sessions for a user.
- `userId`: User identifier
- Returns: Array of chat session metadata

#### `function deleteChatSession(userId: string, sessionId: string) -> object`
Deletes a chat session.
- `userId`: User identifier
- `sessionId`: Chat session identifier
- Returns: Object with success status

### synthesize-data.py
---

Python script for generating synthetic biomarker data for testing and demo purposes.

#### `def generate_biomarker_data_batch(duration_seconds=60, sample_rate=50, output_file="biomarker_data.csv", add_noise=True, add_trend=True) -> pandas.DataFrame`
Generates synthetic biomarker time series data in batch mode.
- `duration_seconds`: Duration of the time series in seconds
- `sample_rate`: Number of samples per second (Hz)
- `output_file`: Path to save the CSV output
- `add_noise`: Whether to add random noise to the signal
- `add_trend`: Whether to add slow-varying trends
- Returns: DataFrame with generated biomarker data

#### `def generate_single_reading(base_time=None, add_noise=True, add_small_trend=True, time_offset=0) -> dict`
Generates a single biomarker reading.
- `base_time`: Base timestamp for the reading
- `add_noise`: Whether to add random noise
- `add_small_trend`: Whether to add slow-varying trend component
- `time_offset`: Time offset in seconds from base_time
- Returns: Dictionary with biomarker readings

#### `def stream_biomarker_data(server_url='http://localhost:3000/readings', stream_interval=0.2, sample_rate=50, duration_hours=None, add_noise=True, add_trend=True, verbose=True, websocket_port=None, test_mode=False, save_csv=True, output_file='biomarker_data.csv', csv_update_interval=100, batch_duration_seconds=60, batch_sample_rate=50, batch_output_file=None) -> None`
Streams biomarker data to server in real-time.
- `server_url`: URL to send data to
- `stream_interval`: Time between streaming readings to server (in seconds)
- `sample_rate`: Rate at which to generate and save data (in Hz)
- `duration_hours`: Total duration to stream (None for indefinite)
- `add_noise`: Whether to add random noise to signals
- `add_trend`: Whether to add slow-varying trends
- `verbose`: Whether to print status information
- `websocket_port`: Port for WebSocket server
- `test_mode`: If True, don't actually send data to server
- `save_csv`: Whether to save the streamed data to a CSV file
- `output_file`: Path to save the streaming CSV output
- `csv_update_interval`: Number of readings before updating the CSV file
- `batch_duration_seconds`: Duration in seconds for batch generation
- `batch_sample_rate`: Sample rate in Hz for batch generation
- `batch_output_file`: Path to save the batch CSV output

### routes/research.js
---

Express router for research-related endpoints with admin access control.

#### `async function checkUserInAdminGroup(username: string) -> boolean`
Checks if a user is in the administrators group.
- `username`: User identifier
- Returns: Boolean indicating admin status

#### `const isAdmin(req, res, next) -> void`
Middleware that verifies user has admin privileges.
- Extracts userId from request parameters or query
- Continues to next middleware if user is admin, otherwise returns 403

### webScraper.py
---

Python script for scraping biomarker research papers from scientific sources.

#### `class BiomarkerScraper`
Class for scraping and processing research papers related to biomarkers.

Instance attributes:
- `biomarkers`: List of biomarker terms to search for
- `headers`: HTTP headers for requests
- `output_dir`: Directory to save output files
- `results_df`: DataFrame to store scraping results
- `debug_mode`: Whether to print debug messages
- `paper_registry_file`: Path to registry of processed papers
- `consolidated_file`: Path to consolidated text output
- `processed_papers`: Dictionary of previously processed papers

#### `def __init__(self, output_dir="research_papers") -> None`
Initializes the scraper with configuration settings.
- `output_dir`: Directory to save output files

#### `def debug_print(self, message) -> None`
Prints debug messages if debug mode is enabled.
- `message`: Message to print

#### `def create_output_dir(self) -> None`
Creates output directory if it doesn't exist.

#### `def load_paper_registry(self) -> dict`
Loads the registry of processed papers from a JSON file.
- Returns: Dictionary of processed papers

#### `def save_paper_registry(self) -> None`
Saves the registry of processed papers to a JSON file.

#### `def generate_paper_id(self, paper) -> str`
Generates a unique ID for a paper based on its URL and title.
- `paper`: Paper dictionary with title and URL
- Returns: MD5 hash as paper ID

#### `def is_paper_processed(self, paper_id) -> bool`
Checks if a paper has already been processed.
- `paper_id`: Unique paper identifier
- Returns: Boolean indicating if paper was processed

#### `def search_pubmed(self, query="inflammation biomarkers", max_results=50) -> list`
Searches PubMed for relevant articles using E-utilities API.
- `query`: Search query string
- `max_results`: Maximum number of results to return
- Returns: List of paper dictionaries

#### `def search_arxiv(self, query="inflammation biomarkers", max_results=50) -> list`
Searches arXiv using their API and parses the XML response.
- `query`: Search query string
- `max_results`: Maximum number of results to return
- Returns: List of paper dictionaries

#### `def fetch_paper_details(self, paper) -> str`
Fetches additional details for papers if abstract isn't already available.
- `paper`: Paper dictionary
- Returns: Abstract text or None

#### `def check_relevance(self, text) -> tuple`
Checks if paper is relevant based on biomarkers and inflammation context.
- `text`: Paper text (usually abstract)
- Returns: Tuple of (is_relevant, found_biomarkers)

#### `def has_numerical_data(self, text) -> bool`
Checks if the abstract contains numerical data related to measurements.
- `text`: Paper text (usually abstract)
- Returns: Boolean indicating presence of numerical data

#### `def add_paper_to_consolidated_file(self, paper_data) -> bool`
Adds paper information to a consolidated text file.
- `paper_data`: Dictionary with paper information
- Returns: Success status

#### `def process_paper(self, paper) -> bool`
Processes a single paper and adds to registry if relevant.
- `paper`: Paper dictionary
- Returns: Boolean indicating success

#### `def run(self, query="inflammation biomarkers", max_results=50) -> int`
Runs the scraper with the given query.
- `query`: Search query string
- `max_results`: Maximum number of results to return
- Returns: Count of processed papers

#### `def save_results(self) -> None`
Saves results to CSV file.

## Frontend

### src/App.tsx
---

Main application component that ties together all UI elements.

#### `interface ChatSession`
- `sessionId: string` - Unique session identifier
- `title: string` - Chat title (derived from first message)
- `timestamp: string` - Timestamp of most recent message
- `messageCount: number` - Number of messages in the session

#### `interface ChatMessage`
- `role: string` - Message sender (user or assistant)
- `content: string` - Message content
- `timestamp?: string` - Optional timestamp

#### `const App: React.FC`
Main application component providing the primary UI structure.
- Manages authentication state and user sessions
- Provides navigation between dashboard views
- Handles chat history and session management
- Integrates all major components (HealthDashboard, ChatPanel, etc.)
- Implements responsive design for mobile and desktop

### src/components/graphs/LiveDataGraph.tsx
---

React component for real-time biomarker data visualization.

#### `interface LiveDataGraphProps`
- `biomarker: string` - Biomarker field name to display
- `label: string` - Display label for the graph
- `color?: string` - Color for the graph line
- `refreshInterval?: number` - Interval for refreshing data
- `showPoints?: boolean` - Whether to show data points
- `maxDataPoints?: number` - Maximum data points to display

#### `interface DataPoint`
- `timestamp: string` - Timestamp of the reading
- `value: number` - Biomarker value

#### `interface CustomWebSocket extends WebSocket`
- `lastFieldsReceived?: string` - Last received data fields
- `lastSubscriptionTime?: number` - Time of last subscription
- `lastSimulationTime?: number` - Time of last simulation
- `reconnectTimeout?: number` - Reconnection timeout ID

#### `const LiveDataGraph: React.FC<LiveDataGraphProps>`
Component for displaying real-time biomarker data graph.
- Connects to WebSocket server for data streaming
- Handles data buffering for performance
- Creates visually appealing time-series chart
- Supports auto-reconnection and error handling
- Implements a 60-second sliding window for data display

### src/components/ChatPanel.tsx
---

React component for chat interface with AI assistant integration.

#### `interface ChatMessage`
- `role: string` - Message sender (user or assistant)
- `content: string` - Message content
- `timestamp?: string` - Optional timestamp

#### `interface ChatPanelProps`
- `userId: string | null` - User identifier
- `messages: ChatMessage[]` - Array of chat messages
- `setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>` - State setter for messages
- `sessionId: string | null` - Chat session identifier
- `setSessionId: React.Dispatch<React.SetStateAction<string | null>>` - State setter for sessionId
- `expanded: boolean` - Whether the chat panel is expanded
- `onToggleExpand: () => void` - Function to toggle expanded state
- `userHealthProfile: UserHealthProfile | null` - User health profile data
- `onChatSessionUpdated?: () => void` - Optional callback when chat session updates

#### `const ChatPanel: React.FC<ChatPanelProps>`
Chat interface component for communication with AI assistant.
- Handles message sending and receiving
- Supports dictation/voice input
- Monitors server connection status with reconnection logic
- Implements swipe gestures for mobile interaction
- Formats and displays chat messages with timestamps
- Provides error handling and offline message queueing
- Includes backoff strategy for server reconnection attempts

### src/components/HealthDashboard.tsx
---

Dashboard component for displaying biomarker and health data.

#### `interface BiomarkerReading`
- `id: number` - Reading identifier
- `cortisol_base: number` - Cortisol measurement
- `lactate_base: number` - Lactate measurement
- `uric_acid_base: number` - Uric acid measurement
- `crp_base: number` - C-reactive protein measurement
- `il6_base: number` - Interleukin-6 measurement
- `body_temp_base: number` - Body temperature measurement
- `heart_rate_base: number` - Heart rate measurement
- `blood_oxygen_base: number` - Blood oxygen measurement
- `timestamp: string` - Timestamp of reading

#### `interface BiomarkerAverages`
Object containing average values for each biomarker type.

#### `interface BiomarkerTrends`
Object containing trend indicators for each biomarker type (increasing, decreasing, stable, insufficient data).

#### `interface HealthData`
- `readings: BiomarkerReading[]` - Array of biomarker readings
- `averages: BiomarkerAverages` - Average values for each biomarker
- `trends: BiomarkerTrends` - Trend indicators for each biomarker
- `readingCount: number` - Total number of readings
- `startDate: string` - Start date of readings
- `endDate: string` - End date of readings

#### `interface HealthDashboardProps`
- `userId: string | null` - User identifier
- `isVisible: boolean` - Whether the dashboard is visible

#### `function analyzeHealthData(healthData: HealthData | null, profileData: any) -> string`
Analyzes health data and provides a personalized summary.
- `healthData`: User's health measurements
- `profileData`: User health profile
- Returns: Textual analysis of health status based on biomarker trends and user age

#### `const HealthDashboard: React.FC<HealthDashboardProps>`
Component for displaying comprehensive health metrics.
- Fetches and displays health data
- Shows biomarker trends and values
- Provides visualizations and insights
- Offers different view modes (welcome, vitals, biomarkers, charts)
- Exports health reports as PDF
- Implements interactive biomarker detail cards
- Creates linked summary text for biomarker exploration

### src/hooks/useUserHealthProfile.ts
---

Custom React hook for managing user health profile data.

#### `interface UserHealthProfile`
- `age?: number` - User's age
- `gender?: string` - User's gender
- `height?: number` - Height in cm
- `weight?: number` - Weight in kg
- `preExistingConditions?: string[]` - Array of pre-existing conditions
- `alcohol?: string` - Alcohol consumption level (none, occasional, moderate, heavy)
- `smoking?: string` - Smoking status (none, occasional, regular, heavy)
- `drugUse?: boolean` - Recreational drug use
- `exerciseLevel?: string` - Exercise intensity level (none, light, moderate, intense)
- `exerciseFrequency?: number` - Exercise frequency per week
- `sleepHours?: number` - Hours of sleep per night
- `stressLevel?: string` - Stress level (low, moderate, high)
- `dietType?: string` - Type of diet (omnivore, vegetarian, vegan, other)
- `language?: string` - Preferred language

#### `function useUserHealthProfile(userId: string | null) -> object`
Hook that manages user health profile state and API interactions.
- `userId`: User's unique identifier
- Returns: Object with the following properties:
  - `profileData: UserHealthProfile | null` - Current health profile data
  - `isLoading: boolean` - Loading state for profile data
  - `showProfileForm: boolean` - Whether to show profile form
  - `setShowProfileForm: Function` - Function to toggle form visibility 
  - `saveProfile: Function` - Function to save profile to server
  - `updateProfile: Function` - Function to update partial profile data
  - `getProfileForLLM: Function` - Function to format profile data for LLM context

### src/hooks/useDictation.ts
---

Custom React hook for speech-to-text dictation functionality.

#### `interface DictationResult`
- `isListening: boolean` - Whether dictation is active
- `transcript: string` - Current recognized speech text
- `error: string | null` - Error message if dictation fails
- `start: () => Promise<void>` - Function to start dictation
- `stop: () => void` - Function to stop dictation

#### `function useDictation() -> DictationResult`
Hook that provides speech recognition capabilities.
- Returns: DictationResult object with dictation state and controls
- Implements audio recording and server-side transcription
- Includes automatic inactivity detection
- Handles errors gracefully
- Manages MediaRecorder lifecycle