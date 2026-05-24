import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image
import numpy as np
import io
import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ----------------------------------------------------------------------
# Paths to your local model and class names (absolute paths)
# ----------------------------------------------------------------------
MODEL_PATH = r"C:\Users\User\OneDrive\Desktop\shamba-care\plant-disease-model\best_model.h5"
CLASS_NAMES_PATH = r"C:\Users\User\OneDrive\Desktop\shamba-care\plant-disease-model\class_names.json"

print("Loading model...")
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model not found at {MODEL_PATH}")

# Load model – this model was saved from EfficientNetV2 training and does not require custom objects.
model = load_model(MODEL_PATH)
print("✅ Model loaded successfully.")

# Print input shape for debugging
input_shape = model.input_shape
print(f"Model input shape: {input_shape}")  # Should be (None, 224, 224, 3)

# ----------------------------------------------------------------------
# Load class names – the JSON contains keys: "raw", "clean", "class_indices"
# ----------------------------------------------------------------------
with open(CLASS_NAMES_PATH, 'r') as f:
    class_data = json.load(f)

if isinstance(class_data, dict):
    # Prefer the "clean" names (e.g., "Apple - Apple scab")
    if "clean" in class_data:
        CLASS_NAMES = class_data["clean"]
    elif "raw" in class_data:
        CLASS_NAMES = class_data["raw"]
    else:
        # Fallback: use values of the dictionary (assuming it's a mapping)
        CLASS_NAMES = list(class_data.values())
else:
    CLASS_NAMES = class_data

print(f"✅ Loaded {len(CLASS_NAMES)} disease classes.")
print(f"First few classes: {CLASS_NAMES[:3]}")

# ----------------------------------------------------------------------
# Image preprocessing: resize to (224, 224) and normalize to [0,1]
# ----------------------------------------------------------------------
def preprocess_image(image_bytes):
    img = image.load_img(io.BytesIO(image_bytes), target_size=(224, 224))
    img_array = image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = img_array / 255.0   # EfficientNet expects [0,1] input
    return img_array

# ----------------------------------------------------------------------
# Treatment database (expand as needed)
# ----------------------------------------------------------------------
def get_treatment(disease_name):
    # Simple placeholder – replace with a comprehensive dictionary
    treatments = {
        "Corn (maize) - Common rust": {
            "organic": "Apply neem oil or sulfur spray. Remove infected leaves.",
            "chemical": "Azoxystrobin or pyraclostrobin.",
            "symptoms": "Cinnamon-brown pustules on leaves.",
            "cost": 550,
            "prevention": "Use resistant hybrids, rotate crops."
        },
        "Potato - Late blight": {
            "organic": "Remove infected leaves, use copper spray.",
            "chemical": "Mancozeb or metalaxyl.",
            "symptoms": "Water-soaked lesions on leaves.",
            "cost": 650,
            "prevention": "Resistant varieties, avoid overhead watering."
        }
    }
    # Return specific treatment if found, else generic
    return treatments.get(disease_name, {
        "organic": "Consult local agrovet for organic options.",
        "chemical": "Consult local agrovet for chemical control.",
        "symptoms": "Visible spots, lesions, or unusual discoloration.",
        "cost": 500,
        "prevention": "Practice crop rotation, use resistant varieties, and monitor regularly."
    })

# ----------------------------------------------------------------------
# Prediction endpoint – compatible with your Node.js frontend
# ----------------------------------------------------------------------
@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image', 'success': False}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No file', 'success': False}), 400

    try:
        image_bytes = file.read()
        input_tensor = preprocess_image(image_bytes)
        predictions = model.predict(input_tensor)[0]
        probabilities = tf.nn.softmax(predictions).numpy()
        idx = np.argmax(probabilities)
        confidence = float(probabilities[idx]) * 100
        disease_raw = CLASS_NAMES[idx]
        # Format disease name for display (replace underscores and separators)
        disease_display = disease_raw.replace('___', ' - ').replace('_', ' ')

        treatment = get_treatment(disease_display)

        response = {
            'success': True,
            'disease': disease_display,
            'confidence': round(confidence, 1),
            'organic_solution': treatment['organic'],
            'chemical_solution': treatment['chemical'],
            'symptoms': treatment['symptoms'],
            'estimated_cost': treatment['cost'],
            'prevention_tips': treatment['prevention'],
            'source': 'EfficientNetV2 (PlantVillage - local)'
        }
        return jsonify(response)
    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model_loaded': True})

if __name__ == '__main__':
    print("🚀 Starting AI service with local EfficientNetV2 model...")
    app.run(host='0.0.0.0', port=5001, debug=True)