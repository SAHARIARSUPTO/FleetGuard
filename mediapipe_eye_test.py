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

API_URL = "https://fleetguard-six.vercel.app/api/data"
SIREN_API_URL = "https://fleetguard-six.vercel.app/api/siren"

SIREN_DURATION = 10
processed_commands = set()

# EAR SETTINGS
EYE_AR_THRESH = 0.25
EYE_AR_CONSEC_FRAMES = 20

LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]

# ---------- GLOBAL STATE ----------
blink_counter = 0
eye_closed_time = 0
is_drowsy = False

SPEED = 0
GPS = {"lat": 24.879915, "lng": 88.271300}

gps_lock = threading.Lock()
arduino = None
siren_off_timer = None

# ---------- ARDUINO INIT ----------
try:
    arduino = serial.Serial(ARDUINO_PORT, ARDUINO_BAUD, timeout=1)
    time.sleep(2)
    print("[INIT] Arduino Connected")
except:
    print("[INIT] Arduino NOT found. Running in Simulation Mode.")

# ---------- SAFE SERIAL ----------
def safe_serial_write(data):
    try:
        if arduino:
            arduino.write(data)
    except:
        pass

# ---------- SEND DATA ----------
def send_data(alert_status, speed, gps_data):
    payload = {
        "vehicleId": VEHICLE_ID,
        "speed": speed,
        "gps": gps_data,
        "alert": alert_status,
        "driver": {"id": DRIVER_ID, "name": DRIVER_NAME},
        "timestamp": time.time()
    }

    def post_data():
        try:
            requests.post(API_URL, json=payload, timeout=2)
            print(f"[DATA SENT] Alert: {alert_status}")
        except Exception as e:
            print(f"[ERR] API Fail: {e}")

    threading.Thread(target=post_data).start()

# ---------- EAR CALC ----------
def get_eye_aspect_ratio(landmarks, eye_indices):
    p = [landmarks[i] for i in eye_indices]
    A = ((p[1].x - p[5].x)**2 + (p[1].y - p[5].y)**2)**0.5
    B = ((p[2].x - p[4].x)**2 + (p[2].y - p[4].y)**2)**0.5
    C = ((p[0].x - p[3].x)**2 + (p[0].y - p[3].y)**2)**0.5
    return (A + B) / (2.0 * C)

# ---------- READ GPS ----------
def read_gps_from_arduino():
    global GPS
    if not arduino:
        return

    while True:
        try:
            if arduino.in_waiting > 0:
                line = arduino.readline().decode('utf-8').strip()
                if line.startswith("{") and line.endswith("}"):
                    data = json.loads(line)
                    with gps_lock:
                        GPS.update({
                            "lat": data.get("lat", GPS["lat"]),
                            "lng": data.get("lng", GPS["lng"])
                        })
        except:
            pass
        time.sleep(0.1)

threading.Thread(target=read_gps_from_arduino, daemon=True).start()

# ---------- SIREN COMMAND POLLER ----------
def poll_siren_api():
    global siren_off_timer, is_drowsy

    while True:
        try:
            res = requests.get(SIREN_API_URL, timeout=2)
            cmds = res.json()

            for cmd in cmds:
                cid = cmd["_id"]
                vid = cmd["vehicleId"]
                action = cmd["command"]
                ts = cmd.get("timestamp", 0)

                # ------- FILTERS ----------
                if vid != VEHICLE_ID:
                    continue

                if cmd.get("status") != "PENDING":
                    continue

                # ignore old commands (>5 sec)
                if time.time() - ts > 5:
                    continue

                if cid in processed_commands:
                    continue

                processed_commands.add(cid)
                print(f"[SIREN] New Command: {action}")

                # cancel old timer
                if siren_off_timer and siren_off_timer.is_alive():
                    siren_off_timer.cancel()

                # ------- ACTIONS ----------
                if action == "TRIGGER_ALARM":
                    print("[SIREN] Alarm Triggered!")
                    safe_serial_write(b'B')

                    def auto_reset_alarm():
                        safe_serial_write(b'S')
                        print("[SIREN] Alarm Auto Reset -> S sent")

                    siren_off_timer = threading.Timer(SIREN_DURATION, auto_reset_alarm)
                    siren_off_timer.start()

                elif action == "KILL_ENGINE":
                    print("[SIREN] Engine Kill ACTIVATED!")
                    safe_serial_write(b'K')

                    # auto reset after 1 sec
                    def auto_reset_engine():
                        safe_serial_write(b'S')
                        print("[SIREN] Engine Auto Reset -> S sent")

                    threading.Timer(1, auto_reset_engine).start()

                elif action == "RESET":
                    print("[SIREN] RESET COMMAND")
                    safe_serial_write(b'S')
                    is_drowsy = False

            time.sleep(1)

        except Exception:
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
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb)

    SPEED = 50

    # ---------- DROWSINESS ----------
    if results.multi_face_landmarks:
        lm = results.multi_face_landmarks[0].landmark
        
        L = get_eye_aspect_ratio(lm, LEFT_EYE)
        R = get_eye_aspect_ratio(lm, RIGHT_EYE)
        EAR = (L + R) / 2

        if EAR < EYE_AR_THRESH:
            eye_closed_time += 1
        else:
            eye_closed_time = 0
            if is_drowsy:
                is_drowsy = False
                safe_serial_write(b'S')
                with gps_lock:
                    send_data(False, SPEED, dict(GPS))

        if eye_closed_time > EYE_AR_CONSEC_FRAMES and not is_drowsy:
            is_drowsy = True
            safe_serial_write(b'A')
            with gps_lock:
                send_data("Sleeping", SPEED, dict(GPS))

        cv2.putText(frame, f"EAR: {EAR:.2f}", (30, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255) if is_drowsy else (0,255,0), 2)

        if is_drowsy:
            cv2.putText(frame, "DROWSINESS ALERT!", (100, 300),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0,0,255), 3)

    # ---------- HEARTBEAT ----------
    if time.time() - last_send_time > SEND_INTERVAL_SECONDS:
        with gps_lock:
            send_data("Sleeping" if is_drowsy else False, SPEED, dict(GPS))
        last_send_time = time.time()

    cv2.imshow("FleetGuard AI", frame)
    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
