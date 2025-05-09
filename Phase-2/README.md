# HealthLLM

## Overview

The **HealthLLM** is an AI-powered application designed to process time series medical data and respond to user queries about their health. The chatbot analyzes user-provided lab results, identifies trends over time, and generates insightful, user-friendly explanations. It aims to assist users in understanding their medical data while offering potential insights into their health conditions.

---

## Features

- **Time Series Data Analysis**: Processes historical lab data to track changes and trends over time.
- **Medical Insights**: Identifies potential conditions based on deviations from normal ranges.
- **User-Friendly Responses**: Delivers explanations in simple, easy-to-understand language.
- **Reassurance for Normal Results**: If all data is within normal bounds, reassures users of their health status.
- **Real-Time Question Response**: Accepts and answers user queries about their health.

---

## Use Cases

- **Health Monitoring**: Track health trends over time using lab data.
- **Question Analysis**: Ask questions such as "Why is my glucose high?" or "What does this value mean?".
- **Educational Support**: Helps users understand medical terms and lab results.
- **Health Status Updates**: Gives users quick feedback on whether their values are normal or concerning.
  
## UML Class Diagram
- https://app.moqups.com/ZtD7yot9rXUApfoo75lY6rCbaULTsf0W/view/page/a8bfb0d3e
## Design Doc
- https://docs.google.com/document/d/1XtADUEZCq_jAXLOWpspbJh20ZbmForN4n8VsaeKIIJY/edit?usp=sharing
---


## Installation

### Requirements

- Python 3.9+
- Node.js and npm (for front-end)
- Libraries:
  - Flask (for API)
  - Langchain (language model integration)
  - Pandas (data handling)
  - Pinecone (vector database)
  - Cohere (language model integration)
  - OPENAI API

---

## Initial Setup

1. Create an `.env` file in `Backend/server` with the following keys:

   ```
   OPENAI_API_KEY = 
   PINECONE_API_KEY = 
   COHERE_API_KEY = 
   ```

2. Navigate to the front-end directory and install dependencies:

   ```
   cd Web-chat/src
   npm install
   cd ../../
   ```

---

## How to Start the Program

1. From the home directory, start the **back-end** application by running the startup script:

   - On Windows:
     ```
     ./run.bat
     ```
   - On Linux or Mac:
     ```
     ./run.sh
     ```

   **Note**: Give the back-end a couple of minutes to start up before asking questions. The Python terminal will display `STARTUP FINISHED` when it is ready. The first run may take longer as required packages are being installed and configured.

2. Navigate to the `Web-chat/src` directory and start the **front-end** application:

   ```
   cd Web-chat/src
   npm start
   ```

   **Note**: To access the admin page, log in using the `x10e` admin email and password.

---

## API Endpoints

| Method | Endpoint           | Description                                 |
| ------ | ------------------ | ------------------------------------------- |
| GET    | `/`                | Entry point for the API.                    |
| POST   | `/chat/<int:user>` | Send a message and receive a chatbot reply. |
| POST   | `/api/device-data` | Insert bulk device data.                    |
| POST   | `/api/user-info`   | Insert user information.                    |
| POST   | `/settings`        | Update application settings.                |
| POST   | `/health-profile`  | Retrieve a health profile summary.          |

---

## Future Improvements

- When real-time data import is enabled, dynamically adjust the analysis time frame for user queries in HomeUI.
- Integrate new fine-tuned LLMs seamlessly using the LLM manager.

---

## Contributors

- **Jeffrey Winters** - Project Lead, AI Engineer, Cloud Developer
- **Rohit Vedulla** - Full-Stack Developer, Data Engineer
- **Ezequiel Carlos** - Full-Stack Developer, Data Engineer
- **Albert Shih** - Front-end Developer, UI/UX/GUI Designer, Data Engineer
- **Cameron Gadalla** - Full-Stack Developer, UI/UX/GUI Designer

---

## Feedback

If you encounter any issues, please open an issue on [GitHub](https://github.com/SuperBons/x10e-316/issues).


