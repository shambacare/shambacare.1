# train_model.py
import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.applications import EfficientNetB0
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
import json
import os

# === CONFIGURATION ===
# Your dataset is two levels up in the plantvillage folder
DATA_DIR = "../../plantvillage"   # <-- UPDATE THIS if needed
IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 25

# If the dataset path doesn't work, use an absolute path:
# DATA_DIR = "C:/Users/User/OneDrive/Desktop/shamba-care/plantvillage"

print("📂 Loading dataset from:", DATA_DIR)

# === LOAD DATASET ===
train_ds = tf.keras.preprocessing.image_dataset_from_directory(
    DATA_DIR,
    validation_split=0.2,
    subset="training",
    seed=42,
    image_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE
)

val_ds = tf.keras.preprocessing.image_dataset_from_directory(
    DATA_DIR,
    validation_split=0.2,
    subset="validation",
    seed=42,
    image_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE
)

# Get class names
class_names = train_ds.class_names
print(f"✅ Found {len(class_names)} classes: {class_names}")

# Save class_names.json
with open("class_names.json", "w") as f:
    json.dump(class_names, f, indent=2)
print("✅ Saved class_names.json")

# === DATA AUGMENTATION ===
autotune = tf.data.AUTOTUNE
train_ds = train_ds.prefetch(buffer_size=autotune)
val_ds = val_ds.prefetch(buffer_size=autotune)

# === BUILD MODEL ===
base_model = EfficientNetB0(
    include_top=False,
    weights='imagenet',
    input_shape=(IMG_SIZE, IMG_SIZE, 3)
)
base_model.trainable = False

model = models.Sequential([
    base_model,
    layers.GlobalAveragePooling2D(),
    layers.Dense(128, activation='relu'),
    layers.Dropout(0.3),
    layers.Dense(len(class_names), activation='softmax')
])

model.compile(
    optimizer='adam',
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

# === CALLBACKS ===
callbacks = [
    EarlyStopping(patience=6, restore_best_weights=True),
    ReduceLROnPlateau(factor=0.2, patience=3, min_lr=1e-6),
    ModelCheckpoint("best_model.h5", save_best_only=True)
]

# === TRAIN ===
print("🚀 Starting training...")
history = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS,
    callbacks=callbacks
)

print("✅ Training complete! Model saved as best_model.h5")

# === EVALUATE ===
loss, acc = model.evaluate(val_ds)
print(f"📊 Validation Accuracy: {acc:.2%}")