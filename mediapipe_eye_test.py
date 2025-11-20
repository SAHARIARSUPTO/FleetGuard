import cv2
import mediapipe as mp
import time
import serial
import requests
import threading
import json

# ---------- SETTINGS ----------
ARDUINO_PORT = 'COM3' 
ARDUINO_BAUD = 115200
SEND_INTERVAL_SECONDS = 5 
VEHICLE_ID = "BUS12"
DRIVER_ID = "DRV007"
DRIVER_NAME = "Karimul Driver"
API_URL = "http://fleetguard-six.vercel.app/api/data"
SIREN_API_URL = "http://fleetguard-six.vercel.app/api/siren"

# Siren settings
SIREN_DURATION = 10  # seconds siren stays ON
processed_commands = set()  # track which commands have been handled

# EAR SETTINGS
EYE_AR_THRESH = 0.25
EYE_AR_CONSEC_FRAMES = 20 
LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]

# ---------- GLOBALS ----------
blink_counter = 0
eye_closed_time = 0
is_drowsy = False
SPEED = 0
GPS = {"lat": 23.8103, "lng": 90.4125} 
gps_lock = threading.Lock()
arduino = None

# ---------- INITIALIZE ARDUINO ----------
try:
    arduino = serial.Serial(ARDUINO_PORT, ARDUINO_BAUD, timeout=1)
    time.sleep(2)
    print("[INIT] Arduino Connected")
except:
    print("[INIT] Arduino NOT found. Simulation Mode.")

# ---------- HELPER FUNCTIONS ----------
def safe_serial_write(data):
    if arduino:
        try: arduino.write(data)
        except: pass

def send_data(alert_status, speed, gps_data):
    payload = {
        "vehicleId": VEHICLE_ID,
        "speed": speed,
        "gps": gps_data,
        "alert": alert_status, 
        "driver": { "id": DRIVER_ID, "name": DRIVER_NAME },
        "timestamp": time.time()
    }
    
    def post_request():
        try:
            requests.post(API_URL, json=payload, timeout=2)
            print(f"[DATA SENT] Alert: {alert_status}")
        except Exception as e:
            print(f"[ERR] API Fail: {e}")

    threading.Thread(target=post_request).start()

def get_eye_aspect_ratio(landmarks, eye_indices):
    p1 = landmarks[eye_indices[0]]
    p2 = landmarks[eye_indices[1]]
    p3 = landmarks[eye_indices[2]]
    p4 = landmarks[eye_indices[3]]
    p5 = landmarks[eye_indices[4]]
    p6 = landmarks[eye_indices[5]]
    A = ((p2.x - p6.x)**2 + (p2.y - p6.y)**2)**0.5
    B = ((p3.x - p5.x)**2 + (p3.y - p5.y)**2)**0.5
    C = ((p1.x - p4.x)**2 + (p1.y - p4.y)**2)**0.5
    return (A + B) / (2.0 * C)

# ---------- GPS READER THREAD ----------
def read_gps_from_arduino():
    global GPS
    if not arduino: return
    while True:
        try:
            if arduino.in_waiting > 0:
                line = arduino.readline().decode('utf-8').strip()
                if line.startswith("{") and line.endswith("}"):
                    data = json.loads(line)
                    with gps_lock:
                        GPS['lat'] = data.get('lat', GPS['lat'])
                        GPS['lng'] = data.get('lng', GPS['lng'])
        except:
            pass
        time.sleep(0.1)

gps_thread = threading.Thread(target=read_gps_from_arduino, daemon=True)
gps_thread.start()

# ---------- POLL SIREN API WITH DEBOUNCE ----------
def poll_siren_api():
    global processed_commands
    while True:
        try:
            res = requests.get(SIREN_API_URL, timeout=2)
            data = res.json()
            now = time.time()

            for cmd in data:
                vid = cmd.get("vehicleId")
                cid = cmd.get("id")  # unique id of the command in DB
                action = cmd.get("command")

                if vid == VEHICLE_ID and cid not in processed_commands:
                    processed_commands.add(cid)

                    if action == "TRIGGER_ALARM":
                        print("[SIREN] Triggering Alarm")
                        safe_serial_write(b'B')
                        # stop siren after duration
                        threading.Timer(SIREN_DURATION, lambda: safe_serial_write(b'S')).start()

                    elif action == "KILL_ENGINE":
                        print("[SIREN] Kill Engine")
                        safe_serial_write(b'K')

                    elif action == "RESET":
                        print("[SIREN] Reset")
                        safe_serial_write(b'S')
                        global is_drowsy
                        is_drowsy = False

            time.sleep(1)
        except Exception as e:
            # Timeout or connection errors
            time.sleep(1)

threading.Thread(target=poll_siren_api, daemon=True).start()

# ---------- MAIN LOOP ----------
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(max_num_faces=1, refine_landmarks=True)
cap = cv2.VideoCapture(0)
last_send_time = time.time()
print("[MAIN] FleetGuard AI running...")

while True:
    ret, frame = cap.read()
    if not ret: break

    frame = cv2.flip(frame, 1)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_frame)
    
    SPEED = 50 

    # --- DROWSINESS LOGIC ---
    if results.multi_face_landmarks:
        lm = results.multi_face_landmarks[0].landmark
        left_ear = get_eye_aspect_ratio(lm, LEFT_EYE)
        right_ear = get_eye_aspect_ratio(lm, RIGHT_EYE)
        avg_ear = (left_ear + right_ear) / 2.0

        if avg_ear < EYE_AR_THRESH:
            eye_closed_time += 1
        else:
            eye_closed_time = 0
            if is_drowsy: 
                is_drowsy = False
                safe_serial_write(b'S')
                with gps_lock: gps_copy = dict(GPS)
                send_data(False, SPEED, gps_copy)

        if eye_closed_time > EYE_AR_CONSEC_FRAMES:
            if not is_drowsy:
                is_drowsy = True
                safe_serial_write(b'A')
                with gps_lock: gps_copy = dict(GPS)
                send_data("Sleeping", SPEED, gps_copy)

        # Draw UI on Frame
        color = (0, 0, 255) if is_drowsy else (0, 255, 0)
        cv2.putText(frame, f"EAR: {avg_ear:.2f}", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
        if is_drowsy:
            cv2.putText(frame, "DROWSINESS ALERT!", (100, 300), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)

    # --- HEARTBEAT ---
    if time.time() - last_send_time > SEND_INTERVAL_SECONDS:
        with gps_lock: gps_copy = dict(GPS)
        payload_alert = "Sleeping" if is_drowsy else False
        send_data(payload_alert, SPEED, gps_copy)
        last_send_time = time.time()

    cv2.imshow("FleetGuard AI", frame)
    if cv2.waitKey(1) & 0xFF == 27: break

cap.release()
cv2.destroyAllWindows()
