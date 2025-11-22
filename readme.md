# Drowsiness Detection System

A real‑time driver drowsiness monitoring system built using Python, OpenCV, MediaPipe, and Arduino. The system identifies fatigue signs like eye closure or yawning, then triggers hardware alerts (buzzer, LEDs) and sends data to a server.

## 🚀 Overview

This project captures live video, tracks facial landmarks, and calculates the Eye Aspect Ratio (EAR) to detect if a driver is feeling sleepy. When drowsiness is detected, a signal is sent to an Arduino which activates alarms. The system also periodically uploads data to a backend API for monitoring.

## ✨ Features

* Real‑time eye tracking using MediaPipe
* EAR‑based drowsiness detection
* Serial communication with Arduino (USB)
* Automatic siren/buzzer triggering
* GPS and sensor data syncing support (if connected)
* API integration for remote monitoring
* Threaded data sending every few seconds

## 🛠️ Technologies Used

* **Python**
* **OpenCV**
* **MediaPipe Face Mesh**
* **Arduino (Serial Communication)**
* **Requests (API calls)**
* **Threading**

## 📁 Project Structure

```
project/
│
├── main.py                # Main Python script for drowsiness detection
├── arduino_code.ino       # Arduino firmware
├── requirements.txt        # Python dependencies
├── README.md              # Project documentation
└── /api                   # Optional backend API folder
```

## 🔧 Hardware Setup

* Arduino Uno / Mega / Nano
* Piezo buzzer
* LEDs (optional)
* USB cable for serial communication
* Webcam (any decent 720p camera)

### Arduino Serial Commands

Python sends commands like:

```
"ALARM_ON"     → activate buzzer
"ALARM_OFF"    → stop buzzer
```

Modify your Arduino code to react to these messages.

## 💻 Software Setup

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/drowsiness-detection
cd drowsiness-detection
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the detection script

```bash
python main.py
```

## 🔍 How Detection Works

### Eye Aspect Ratio (EAR)

The system detects the distance between eyelids. If EAR drops below a threshold for a specific duration → **driver is drowsy**.

### MediaPipe Face Mesh

Used for:

* Eye landmark tracking
* Blink/yawn detection
* Facial movement analysis

### API Data Upload

Every few seconds, the script sends driver status + GPS + sensor data to a remote server endpoint.

## 🌐 API Example (POST)

```json
{
  "vehicleId": "BUS12",
  "driverId": "DRV007",
  "driverName": "Karimul Driver",
  "status": "DROWSY",
  "gps": {
    "lat": 23.8103,
    "lng": 90.4125
  }
}
```

## 🧪 Testing

* Cover your eyes or blink slowly → alarm should trigger
* Disconnect Arduino → script still runs but logs errors
* Test sitting far/close to the camera

## 📌 Common Issues

### Camera not opening

```
cv2.error: can't open camera
```

→ Change the camera index: `cap = cv2.VideoCapture(0)` → `1` or `2`.

### Serial port error

→ Update:

```python
ARDUINO_PORT = 'COM3'
```

To match your system.

## 📜 License

MIT License — free to use, modify, and distribute.

## 🙌 Acknowledgements

* Google MediaPipe team
* OpenCV community
* Arduino documentation

## ⭐ Contribute

Pull requests are welcome! If you improve EAR calculation or add new sensors, feel free to contribute.

---

Made for real‑time road safety.
