from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import mediapipe as mp
import numpy as np

app = Flask(__name__)
CORS(app)

# Initialize MediaPipe on GPU
mp_holistic = mp.solutions.holistic
holistic = mp_holistic.Holistic(
    model_complexity=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
).to_tensor().gpu()

@app.route('/process', methods=['POST'])
def process_frame():
    # Process frame with GPU acceleration
    frame_data = request.json['frame']
    # ... processing code ...
    return jsonify(results)

if __name__ == '__main__':
    app.run(port=5000) 