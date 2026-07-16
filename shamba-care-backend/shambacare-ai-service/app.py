import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image
from tensorflow.keras.applications.efficientnet import preprocess_input
import numpy as np
import io
import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError

app = Flask(__name__)
CORS(app)

# ----------------------------------------------------------------------
# Paths to model and class names
# ----------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "best_model.h5")
CLASS_NAMES_PATH = os.path.join(BASE_DIR, "class_names.json")

# Check if files exist
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model not found at {MODEL_PATH}")
if not os.path.exists(CLASS_NAMES_PATH):
    raise FileNotFoundError(f"Class names not found at {CLASS_NAMES_PATH}")

print("Loading model...")
model = load_model(MODEL_PATH)
print("Model loaded successfully.")
print(f"Model input shape: {model.input_shape}")

# Load class names
with open(CLASS_NAMES_PATH, 'r') as f:
    class_data = json.load(f)

if isinstance(class_data, dict):
    if "clean" in class_data:
        CLASS_NAMES = class_data["clean"]
    elif "raw" in class_data:
        CLASS_NAMES = class_data["raw"]
    else:
        CLASS_NAMES = list(class_data.values())
else:
    CLASS_NAMES = class_data

print(f"Loaded {len(CLASS_NAMES)} disease classes.")
print(f"First few classes: {CLASS_NAMES[:3]}")

# ----------------------------------------------------------------------
# Image preprocessing – Correct for EfficientNetB0
# ----------------------------------------------------------------------
def preprocess_image(image_bytes):
    img = image.load_img(io.BytesIO(image_bytes), target_size=(224, 224))
    img_array = image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = preprocess_input(img_array)
    return img_array

# ----------------------------------------------------------------------
# Validation helper – checks if the image is valid and likely a plant leaf
# ----------------------------------------------------------------------
def validate_image(image_bytes, filename):
    # 1. Check file size (max 10 MB)
    if len(image_bytes) > 10 * 1024 * 1024:
        return False, "Image is too large. Please upload a file smaller than 10 MB."

    # 2. Try to open with PIL to verify it's a valid image
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        pil_img.verify()  # Verify integrity
    except UnidentifiedImageError:
        return False, "The file does not appear to be a valid image. Please upload a JPG or PNG photo of a plant leaf."
    except Exception:
        return False, "The image file seems corrupted. Please try a different photo."

    # 3. Optionally check dimensions (minimum size to be useful)
    # (we'll re-open because verify closes the file)
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        width, height = pil_img.size
        if width < 100 or height < 100:
            return False, "The image is too small. Please upload a clearer, larger photo of the leaf."
    except:
        pass

    return True, "OK"

# ----------------------------------------------------------------------
# Full Disease Library – Organic & Chemical Solutions
# ----------------------------------------------------------------------
def get_treatment(disease_name):
    disease_key = disease_name.strip()

    treatments = {
        # ---- Maize (Corn) ----
        "Corn (maize) - Cercospora leaf spot Gray leaf spot": {
            "organic": "Remove crop residues; apply sulfur spray.",
            "chemical": "Azoxystrobin or pyraclostrobin.",
            "symptoms": "Small, rectangular grayish lesions with yellow margins.",
            "cost": 600,
            "prevention": "Crop rotation; use disease-free seeds."
        },
        "Corn (maize) - Common rust": {
            "organic": "Apply neem oil or sulfur spray; remove infected leaves.",
            "chemical": "Azoxystrobin or pyraclostrobin.",
            "symptoms": "Cinnamon-brown pustules on leaves.",
            "cost": 550,
            "prevention": "Use resistant hybrids, rotate crops."
        },
        "Corn (maize) - Northern Leaf Blight": {
            "organic": "Remove crop residues; apply compost tea.",
            "chemical": "Azoxystrobin or mancozeb.",
            "symptoms": "Long, elliptical gray-green lesions on lower leaves.",
            "cost": 650,
            "prevention": "Plant resistant hybrids; rotate crops."
        },
        "Corn (maize) - healthy": {
            "organic": "Maintain good field hygiene.",
            "chemical": "None needed.",
            "symptoms": "No visible symptoms.",
            "cost": 0,
            "prevention": "Regular scouting and balanced nutrition."
        },

        # ---- Potato ----
        "Potato - Early blight": {
            "organic": "Mulch; compost tea; remove infected leaves.",
            "chemical": "Chlorothalonil or mancozeb.",
            "symptoms": "Dark, concentric lesions on lower leaves.",
            "cost": 550,
            "prevention": "Crop rotation; well-drained soil."
        },
        "Potato - Late blight": {
            "organic": "Remove infected leaves; copper spray.",
            "chemical": "Mancozeb or metalaxyl.",
            "symptoms": "Dark, water-soaked lesions; white mold on leaf underside.",
            "cost": 600,
            "prevention": "Resistant varieties; avoid overhead watering."
        },
        "Potato - healthy": {
            "organic": "Maintain good soil health.",
            "chemical": "None needed.",
            "symptoms": "No visible symptoms.",
            "cost": 0,
            "prevention": "Proper fertilization and watering."
        },

        # ---- Tomato ----
        "Tomato - Bacterial spot": {
            "organic": "Copper-based soap sprays; remove infected plants.",
            "chemical": "Copper hydroxide or streptomycin.",
            "symptoms": "Small, dark, water-soaked spots on leaves and fruit.",
            "cost": 450,
            "prevention": "Use certified disease-free seeds; avoid overhead irrigation."
        },
        "Tomato - Early blight": {
            "organic": "Mulch; apply compost tea; remove lower leaves.",
            "chemical": "Chlorothalonil or mancozeb.",
            "symptoms": "Dark concentric rings on older leaves; yellowing.",
            "cost": 550,
            "prevention": "Rotate crops; prune for air circulation."
        },
        "Tomato - Late blight": {
            "organic": "Remove infected leaves; copper spray.",
            "chemical": "Mancozeb or metalaxyl.",
            "symptoms": "Water-soaked lesions on leaves; white mold underside.",
            "cost": 600,
            "prevention": "Resistant varieties; avoid overhead watering."
        },
        "Tomato - Leaf Mold": {
            "organic": "Improve air circulation; remove infected leaves.",
            "chemical": "Chlorothalonil or copper fungicide.",
            "symptoms": "Yellow-green spots on upper leaf surface; gray mold underside.",
            "cost": 500,
            "prevention": "Space plants properly; water at base."
        },
        "Tomato - Septoria leaf spot": {
            "organic": "Remove lower leaves; apply compost tea.",
            "chemical": "Chlorothalonil or mancozeb.",
            "symptoms": "Small circular spots with dark borders; yellow halo.",
            "cost": 550,
            "prevention": "Rotate crops; avoid overhead watering."
        },
        "Tomato - Spider mites Two-spotted spider mite": {
            "organic": "Neem oil spray; introduce predatory mites.",
            "chemical": "Abamectin or miticides.",
            "symptoms": "Stippled leaves; fine webbing on underside.",
            "cost": 400,
            "prevention": "Keep plants well-watered; avoid dust."
        },
        "Tomato - Target Spot": {
            "organic": "Remove infected leaves; apply neem oil.",
            "chemical": "Chlorothalonil or mancozeb.",
            "symptoms": "Concentric rings on leaves; dark brown lesions.",
            "cost": 500,
            "prevention": "Good sanitation; avoid wet foliage."
        },
        "Tomato - Tomato mosaic virus": {
            "organic": "No cure; remove infected plants.",
            "chemical": "No chemical cure – vector control.",
            "symptoms": "Mottled yellow-green leaves; deformed fruit.",
            "cost": 0,
            "prevention": "Use virus-free seeds; disinfect tools."
        },
        "Tomato - Tomato Yellow Leaf Curl Virus": {
            "organic": "Control whiteflies with neem oil; yellow sticky traps.",
            "chemical": "Imidacloprid (for vectors).",
            "symptoms": "Yellowing, curling leaves; stunted growth.",
            "cost": 500,
            "prevention": "Use resistant varieties; row covers."
        },
        "Tomato - healthy": {
            "organic": "Continue good farming practices.",
            "chemical": "None needed.",
            "symptoms": "No visible symptoms.",
            "cost": 0,
            "prevention": "Maintain proper nutrition and water."
        }
    }

    if disease_key in treatments:
        return treatments[disease_key]
    for key in treatments:
        if disease_key.lower() in key.lower() or key.lower() in disease_key.lower():
            return treatments[key]
    return {
        "organic": "Consult local agrovet for organic options.",
        "chemical": "Consult local agrovet for chemical control.",
        "symptoms": "Visible spots, lesions, or unusual discoloration.",
        "cost": 500,
        "prevention": "Practice crop rotation, use resistant varieties, and monitor regularly."
    }

# ----------------------------------------------------------------------
# Prediction endpoint with image validation and leaf detection
# ----------------------------------------------------------------------
@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded', 'success': False}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No file selected', 'success': False}), 400

    try:
        image_bytes = file.read()
        filename = file.filename

        # --- VALIDATE IMAGE ---
        valid, msg = validate_image(image_bytes, filename)
        if not valid:
            return jsonify({'error': msg, 'success': False}), 400

        # --- PREPROCESS AND PREDICT ---
        input_tensor = preprocess_image(image_bytes)
        predictions = model.predict(input_tensor)[0]
        probabilities = tf.nn.softmax(predictions).numpy()
        idx = np.argmax(probabilities)
        confidence = float(probabilities[idx]) * 100
        disease_raw = CLASS_NAMES[idx]
        disease_display = disease_raw.replace('___', ' - ').replace('_', ' ')

        # --- CHECK IF IT'S A PLANT LEAF ---
        # If the max confidence is below 12%, it's likely not a plant leaf
        if confidence < 12.0:
            return jsonify({
                'error': 'This doesn\'t look like a clear plant leaf photo. Please upload a close-up of a leaf with good lighting.',
                'success': False
            }), 400

        print(f"Predicted: {disease_display} with confidence {confidence:.1f}%")

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
            'source': 'ShambaCare Model'
        }

        if confidence < 50:
            response['warning'] = 'Low confidence. The image may be blurry; try a clearer photo for better accuracy.'

        return jsonify(response)

    except UnidentifiedImageError:
        return jsonify({'error': 'The file is not a valid image. Please upload a JPG or PNG photo of a plant leaf.', 'success': False}), 400
    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({'error': 'Unable to process the image. Please try a different photo.', 'success': False}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model_loaded': True})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    print(f"Starting AI service on port {port} (debug={debug_mode})...")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
