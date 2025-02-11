@echo off
set VENV_DIR=venv
set MAIN_SCRIPT=Back-end\server\main.py
set NPM_DIR=Back-end\db_api_backend
set NPM_WEBDIR=Web-chat\src
:: Check if venv exists, create if not
if not exist "%VENV_DIR%" (
    echo Creating virtual environment...
    python -m venv "%VENV_DIR%"
)

:: Activate the virtual environment
echo Activating virtual environment...
call "%VENV_DIR%\Scripts\activate"

:: Check pip version
python -m pip --version

:: Install dependencies
if exist requirements.txt (
    echo Installing dependencies...

    pip install -r requirements.txt
) else (
    echo No requirements.txt found, skipping dependency installation.
)
:: Run the main Python script in a new window
if exist "%MAIN_SCRIPT%" (
    echo Running %MAIN_SCRIPT% in a new window...
    start "Python Script" cmd /k "%VENV_DIR%\Scripts\activate && python %MAIN_SCRIPT%"
) else (
    echo Error: %MAIN_SCRIPT% not found!
)

:: Navigate to NPM_DIR and run npm start
if exist "%NPM_DIR%" (
    echo Starting npm server in %NPM_DIR%...
    pushd "%NPM_DIR%"
    echo Installing npm dependencies...
    npm install
    start cmd /k "npm start"
    popd
) else (
    echo Error: %NPM_DIR% not found!
)


:: Deactivate virtual environment
deactivate

pause
