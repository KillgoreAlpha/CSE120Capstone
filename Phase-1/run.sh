#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Define paths relative to script location
VENV_DIR="${SCRIPT_DIR}/venv"
MAIN_SCRIPT="${SCRIPT_DIR}/Back-end/server/main.py"
NPM_DIR="${SCRIPT_DIR}/Back-end/db_api_backend"
NPM_WEBDIR="${SCRIPT_DIR}/Web-chat/src"

# Determine OS type
OS_TYPE=$(uname -s)

# Check and create virtual environment
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate the virtual environment
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Check pip version
python3 -m pip --version

# Install dependencies
if [ -f "${SCRIPT_DIR}/requirements.txt" ]; then
    echo "Installing dependencies..."
    pip install --upgrade pip
    pip install -r "${SCRIPT_DIR}/requirements.txt"
else
    echo "No requirements.txt found, skipping Python dependency installation."
fi

# Function to open new terminal
open_new_terminal() {
    local command=$1
    case "$OS_TYPE" in
        "Darwin")
            osascript -e "tell application \"Terminal\" to do script \"cd $SCRIPT_DIR && $command\""
            ;;
        "Linux")
            if command -v gnome-terminal &> /dev/null; then
                gnome-terminal -- bash -c "cd $SCRIPT_DIR && $command; exec bash"
            else
                echo "gnome-terminal not found. Running in background."
                bash -c "cd $SCRIPT_DIR && $command &"
            fi
            ;;
        *)
            echo "Unsupported OS: $OS_TYPE"
            exit 1
            ;;
    esac
}

# Run the Python script in a new terminal
if [ -f "$MAIN_SCRIPT" ]; then
    echo "Running $MAIN_SCRIPT in a new terminal..."
    open_new_terminal "source $VENV_DIR/bin/activate && python3 $MAIN_SCRIPT"
else
    echo "Error: $MAIN_SCRIPT not found!"
fi

# Navigate to NPM_DIR and run npm start
if [ -d "$NPM_DIR" ]; then
    echo "Starting npm server in $NPM_DIR..."
    cd "$NPM_DIR"
    echo "Installing npm dependencies..."
    npm install
    open_new_terminal "cd $NPM_DIR && npm start"
    cd "$SCRIPT_DIR"
else
    echo "Error: $NPM_DIR not found!"
fi

# Deactivate the virtual environment
deactivate

echo "All processes started successfully."
