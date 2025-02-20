from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from homeUI import hui
from dev_insert_data import devDataInsert
import session_manager
from configs import settings

app = Flask(__name__)
dev_data = devDataInsert()
FEEDBACK_FILE = "feedback.json"
# Enable CORS for all routes and all origins
CORS(app)

@app.route("/")
def entry():
    return "<p></p>"

@app.route('/add_session', methods=['POST'])
def OnSessionAdd():
    if not request.is_json:
        return {"error": 'invalid format'}, 400
    data = request.get_json()
    if session_manager.AddSession(data.get('sid'), session_manager.Session(data.get('uid'))) == -1:
        return {"error": "session already exists"}
    return {"message": "Session added successfully."}, 200

@app.route('/remove_session', methods=['POST'])
def OnSessionRemoved():
    if not request.is_json:
        return {'error': 'invalid format'}, 400
    data = request.get_json()
    session_manager.RemoveSession(data.get('sid'))
    return {"message": "Session removed successfully."}, 200

@app.route("/chat/<int:user>", methods=['POST'])
def OnChatAPICall(user):
    if not request.is_json:
        return {"error": 'invalid format'}, 400
    data = request.get_json()
    print(user)
    return {
        # "message": data.get("chat_id")
        "message": hui.runChat(data.get("chat_id"),data.get("message"),data.get('userId'))
    }, 200

@app.route('/api/device-data', methods=['POST'])
def insert_device_data():
    if not request.is_json:
        return {"error": 'invalid format'}, 400
    data = request.get_json()
    try:
        dev_data.insert_device_data_bulk(data['data_list'])
        return {"message": "Device data inserted successfully"}, 200
    except Exception as e:
        return {"error": str(e)}, 500

@app.route('/api/user-info', methods=['POST'])
def insert_user_info():
    if not request.is_json:
        return {"error": 'invalid format'}, 400
    data = request.get_json()
    try:
        dev_data.insert_user_info(
            name=data['name'],
            age=data['age'],
            gender=data['gender'],
            date_of_visit=data['date_of_visit'],
            previous_visits=data['previous_visits'],
            is_smoker=data['is_smoker'],
            weight=data['weight'],
            height=data['height'],
            bmi=data['bmi']
        )
        return {"message": "User info inserted successfully"}, 200
    except Exception as e:
        return {"error": str(e)}, 500

@app.route('/settings', methods=['POST'])
def handle_settings():
    if request.method == 'GET':
        return jsonify(settings), 200
    elif request.method == 'POST':
        data = request.get_json()
        settings.update(data)
        return jsonify({"message": "Settings have been saved successfully."}), 200

@app.route("/health-profile",methods = ['POST'])
def OnHealthProfileCall():
    print("error")
    if not request.is_json:
        return {"error": 'invalid format'}, 400
    data = request.get_json()
    
    return {
        
        "summary": hui.profiles[1].completeDeviceSummary
    }
@app.route('/feedback', methods=['POST'])
def handle_feedback():
    # Ensure the feedback file exists
    if not os.path.exists(FEEDBACK_FILE):
        with open(FEEDBACK_FILE, "w") as f:
            json.dump([], f)  # Initialize with an empty list

    try:
        # Get data from the POST request
        data = request.json
        if not data or "previousMessages" not in data:
            return jsonify({"error": "Invalid data provided"}), 400

        # Read the existing feedback
        try:
            with open(FEEDBACK_FILE, "r") as f:
                feedback_data = json.load(f)  # Load existing data
        except (FileNotFoundError, json.JSONDecodeError):
            feedback_data = []  # Initialize as empty if file is invalid or missing

        # Check if the previousMessages already exists in feedback
        message_found = False
        for entry in feedback_data:
            if entry.get("previousMessages") == data["previousMessages"]:
                entry.update(data)  # Replace the existing entry with new data
                message_found = True
                break

        # If the message doesn't exist, append it
        if not message_found:
            feedback_data.append(data)

        # Write updated feedback to the file
        with open(FEEDBACK_FILE, "w") as f:
            json.dump(feedback_data, f, indent=2)

        return jsonify({"message": "Feedback updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)