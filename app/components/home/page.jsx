"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useReducer } from "react";
import {
  TruckIcon,
  BellAlertIcon,
  BoltIcon,
  ShieldCheckIcon,
  MapPinIcon,
  PhoneIcon,
  ClockIcon,
  UserIcon,
  MoonIcon,
  PowerIcon,
  SpeakerWaveIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/solid";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

// --- FIX 1: LEAFLET CSS & DYNAMIC IMPORTS ---
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});

// Safely import L for the Icon
let L;
if (typeof window !== "undefined") {
  L = require("leaflet");
}

// --- CUSTOM ICONS ---
const getIcon = (isDrowsy) => {
  if (!L) return null;
  // Use a Red Truck icon if drowsy, otherwise standard
  const iconUrl = isDrowsy
    ? "https://cdn-icons-png.flaticon.com/512/743/743922.png" // Can replace with a red icon URL if you have one
    : "https://cdn-icons-png.flaticon.com/512/743/743922.png";

  return new L.Icon({
    iconUrl: iconUrl,
    iconSize: [45, 45],
    popupAnchor: [0, -20],
    className: isDrowsy ? "leaflet-marker-drowsy" : "",
  });
};

// --- DATA PROCESSING ---
const processFleetData = (rawData) => {
  if (!rawData || rawData.length === 0)
    return { stats: {}, uniqueVehicles: [], history: [] };

  // 1. Sort by timestamp
  const sortedData = [...rawData].sort((a, b) => a.timestamp - b.timestamp);

  // Find the latest timestamp in the entire dataset (Current System Time relative to data)
  const latestSystemTimestamp = sortedData[sortedData.length - 1].timestamp;

  // 2. Group by Vehicle
  const vehicleMap = new Map();

  // Track the LAST TIME an alert was seen for each vehicle
  const lastAlertTimes = {};

  // First Pass: Find alert timestamps
  sortedData.forEach((record) => {
    const isAlertRecord =
      record.alert === true ||
      record.alert === "Sleeping" ||
      record.alert === "true";
    if (isAlertRecord) {
      lastAlertTimes[record.vehicleId] = record.timestamp;
    }
  });

  // Second Pass: Build Vehicle State with LATCHING logic
  sortedData.forEach((record) => {
    const dateObj = new Date(record.timestamp * 1000);

    // LATCHING LOGIC:
    // If an alert happened in the last 5 minutes (300 seconds) relative to the data, keep it RED.
    const lastAlert = lastAlertTimes[record.vehicleId] || 0;
    const secondsSinceAlert = latestSystemTimestamp - lastAlert;

    // It is drowsy if the Current Record is Alert OR if an alert happened < 300s ago
    const isDrowsy =
      record.alert === true ||
      record.alert === "Sleeping" ||
      record.alert === "true" ||
      secondsSinceAlert < 300;

    vehicleMap.set(record.vehicleId, {
      ...record,
      formattedTime: dateObj.toLocaleTimeString(),
      isDrowsy, // This latched value drives the UI
      secondsSinceAlert, // Useful for debugging
      driverPhone: `+880 17${record.driver.id
        .replace(/\D/g, "")
        .padEnd(8, "0")
        .slice(0, 8)}`,
    });
  });

  const uniqueVehicles = Array.from(vehicleMap.values());

  // 3. Calculate Stats
  const totalVehicles = uniqueVehicles.length;
  const drowsinessCount = uniqueVehicles.filter((v) => v.isDrowsy).length;
  const totalSpeed = uniqueVehicles.reduce((sum, v) => sum + (v.speed || 0), 0);
  const avgSpeed =
    totalVehicles > 0 ? (totalSpeed / totalVehicles).toFixed(0) : 0;

  // Calculate Total Events (Historical) for the chart or separate counter
  const totalHistoricalAlerts = sortedData.filter(
    (r) => r.alert === true || r.alert === "Sleeping"
  ).length;

  return {
    stats: { totalVehicles, drowsinessCount, avgSpeed, totalHistoricalAlerts },
    uniqueVehicles,
    history: sortedData
      .map((d) => ({
        time: new Date(d.timestamp * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        speed: d.speed,
        isAlert: d.alert === true || d.alert === "Sleeping" ? 1 : 0, // For dot indicators on chart
      }))
      .slice(-30),
  };
};

// --- UI COMPONENT: STAT CARD ---
const StatCard = ({
  title,
  value,
  unit,
  icon: Icon,
  color,
  bgColor,
  alertMode,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`rounded-2xl p-5 shadow-sm border flex items-center justify-between relative overflow-hidden group transition-all duration-300 ${
      alertMode
        ? "bg-red-600 border-red-700 text-white shadow-red-200 ring-4 ring-red-100"
        : "bg-white border-slate-100 hover:shadow-md"
    }`}
  >
    <div className="z-10">
      <p
        className={`text-xs font-bold uppercase tracking-wider mb-1 ${
          alertMode ? "text-red-100" : "text-slate-400"
        }`}
      >
        {title}
      </p>
      <div className="flex items-baseline gap-1">
        <h3
          className={`text-3xl font-extrabold ${
            alertMode ? "text-white" : "text-slate-800"
          }`}
        >
          {value}
        </h3>
        {unit && (
          <span
            className={`text-sm font-medium ${
              alertMode ? "text-red-200" : "text-slate-500"
            }`}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
    <div
      className={`h-12 w-12 rounded-xl flex items-center justify-center ${
        alertMode
          ? "bg-white/20 text-white animate-pulse"
          : `${bgColor} ${color}`
      }`}
    >
      <Icon className="h-6 w-6" />
    </div>
  </motion.div>
);

// --- MAIN COMPONENT ---
export default function Dashboard() {
  const [data, setData] = useState([]);
  const [isClient, setIsClient] = useState(false);
  const [notification, setNotification] = useState(null);
  const [acknowledged, dispatch] = useReducer((state, action) => {
    switch (action.type) {
      case "ACKNOWLEDGE":
        // Acknowledge a vehicle for 5 minutes
        return { ...state, [action.vehicleId]: Date.now() + 5 * 60 * 1000 };
      case "CLEANUP":
        // Remove expired acknowledgements
        return Object.fromEntries(
          Object.entries(state).filter(([_, expiry]) => expiry > Date.now())
        );
      default:
        return state;
    }
  }, {});

  // --- CONTROL SIMULATION ---
  const showNotification = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleVehicleControl = async (action, vehicleId) => {
    let msg = "";
    switch (action) {
      case "KILL_ENGINE":
        msg = `🛑 COMMAND SENT: Cutting Engine Power for ${vehicleId}...`;
        break;
      case "TRIGGER_ALARM":
        msg = `📢 COMMAND SENT: Triggering Remote Siren for ${vehicleId}...`;
        try {
          const response = await fetch("/api/siren", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              vehicleId,
              timestamp: Math.floor(Date.now() / 1000),
              command: "TRIGGER_ALARM",
            }),
          });
          if (!response.ok) throw new Error("Failed to log siren command.");
        } catch (error) {
          console.error("Siren API Error:", error);
        }
        msg = `📢 COMMAND SENT: Triggering Remote Siren for ${vehicleId}...`;
        break;
      case "RESET":
        msg = `🔄 SYSTEM: Resetting Sensors for ${vehicleId}...`;
        break;
      case "CALL":
        msg = `📞 DIALING: Connecting to Driver of ${vehicleId}...`;
        break;
      default:
        msg = "Command Sent";
    }
    showNotification(msg, action === "KILL_ENGINE" ? "danger" : "info");
  };

  // Fetch Data
  useEffect(() => {
    setIsClient(true);
    const fetchData = () => {
      fetch("/api/data")
        .then((res) => res.json())
        .then((json) => setData(json))
        .catch((e) => console.error(e));
    };

    fetchData();
    const interval = setInterval(fetchData, 1000); // Faster polling
    const ackCleanupInterval = setInterval(() => {
      dispatch({ type: "CLEANUP" });
    }, 5000); // Cleanup expired acks every 5 seconds
    return () => {
      clearInterval(interval);
      clearInterval(ackCleanupInterval);
    };
    return () => clearInterval(interval);
  }, []);

  const { stats, uniqueVehicles, history } = useMemo(
    () => processFleetData(data),
    [data]
  );

  // Memoize icons to prevent flickering
  const vehicleIcons = useMemo(() => {
    if (!isClient) return { normal: null, drowsy: null }; // Don't create icons on the server
    return { normal: getIcon(false), drowsy: getIcon(true) };
  }, [isClient]); // Re-run this memo only when isClient becomes true

  const mapCenter = [23.8909, 89.115]; // Default center

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-10">
      {/* --- NOTIFICATION TOAST --- */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -50, x: "-50%" }}
            className={`fixed top-20 left-1/2 z-[9999] px-6 py-3 rounded-lg shadow-2xl font-bold text-white flex items-center gap-3 ${
              notification.type === "danger" ? "bg-red-600" : "bg-slate-800"
            }`}
          >
            {notification.type === "danger" ? (
              <PowerIcon className="w-6 h-6" />
            ) : (
              <BellAlertIcon className="w-6 h-6" />
            )}
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- HEADER --- */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-lg">
              <TruckIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
                Fleet<span className="text-blue-600">Guard</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                AI Drowsiness Detection
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Active Alert Banner in Header */}
            {stats.drowsinessCount > 0 && (
              <div className="bg-red-600 text-white px-4 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2 shadow-red-200 shadow-lg">
                <ExclamationCircleIcon className="w-4 h-4" /> DANGER:{" "}
                {stats.drowsinessCount} DRIVER(S) DROWSY
              </div>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-400">SYSTEM TIME</p>
              <p className="text-sm font-mono text-slate-700">
                {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
        {/* --- KPI CARDS --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Alerts (5min)"
            value={stats.drowsinessCount || 0}
            unit="Drivers"
            icon={MoonIcon}
            alertMode={stats.drowsinessCount > 0}
            color="text-indigo-600"
            bgColor="bg-indigo-50"
          />
          <StatCard
            title="Total Events (Today)"
            value={stats.totalHistoricalAlerts || 0}
            unit="Events"
            icon={ExclamationCircleIcon}
            color="text-orange-600"
            bgColor="bg-orange-50"
          />
          <StatCard
            title="Active Fleet"
            value={stats.totalVehicles || 0}
            unit="Vehicles"
            icon={TruckIcon}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
          <StatCard
            title="Avg Fleet Speed"
            value={stats.avgSpeed || 0}
            unit="km/h"
            icon={BoltIcon}
            color="text-emerald-600"
            bgColor="bg-emerald-50"
          />
        </div>

        {/* --- DASHBOARD CONTENT --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[700px] lg:h-[600px]">
          {/* LEFT: MAP (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
            <div className="absolute top-4 left-4 z-[400] bg-white/95 backdrop-blur px-4 py-2 rounded-lg shadow-md border-l-4 border-blue-600">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MapPinIcon className="w-4 h-4 text-blue-600" /> Live GPS
                Tracking
              </h2>
            </div>

            <div className="flex-1 w-full h-full bg-slate-100 relative z-0">
              {isClient && (
                <MapContainer
                  center={mapCenter}
                  zoom={13} // Zoomed in slightly
                  scrollWheelZoom={true}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution="&copy; CartoDB"
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  />
                  {uniqueVehicles.map(
                    (d) =>
                      d.gps.lat !== 0 &&
                      d.gps.lng !== 0 && (
                        <Marker
                          key={d._id}
                          position={[d.gps.lat, d.gps.lng]}
                          // Use Red Icon if Drowsy
                          icon={
                            d.isDrowsy
                              ? vehicleIcons.drowsy
                              : vehicleIcons.normal
                          }
                        >
                          <Popup className="custom-popup">
                            <div className="p-1 min-w-[220px]">
                              <div
                                className={`mb-2 pb-2 border-b ${
                                  d.isDrowsy
                                    ? "border-red-200"
                                    : "border-slate-100"
                                }`}
                              >
                                <h3 className="font-bold text-slate-800 text-lg">
                                  {d.vehicleId}
                                </h3>
                                {d.isDrowsy && (
                                  <div className="mt-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded flex items-center gap-1 animate-pulse">
                                    <MoonIcon className="w-3 h-3" /> DROWSINESS
                                    DETECTED
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1 text-sm text-slate-600 mb-3">
                                <div className="flex items-center gap-2">
                                  <UserIcon className="w-4 h-4 text-slate-400" />
                                  <span>{d.driver?.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <BoltIcon className="w-4 h-4 text-slate-400" />
                                  <span className="font-mono">
                                    {d.speed} km/h
                                  </span>
                                </div>
                              </div>

                              {/* CONTROLS IN POPUP */}
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <button
                                  onClick={() =>
                                    handleVehicleControl(
                                      "KILL_ENGINE",
                                      d.vehicleId
                                    )
                                  }
                                  className="col-span-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors"
                                >
                                  <PowerIcon className="w-3 h-3" /> STOP ENGINE
                                </button>
                                <button
                                  onClick={() =>
                                    handleVehicleControl(
                                      "TRIGGER_ALARM",
                                      d.vehicleId
                                    )
                                  }
                                  className="bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1"
                                >
                                  <SpeakerWaveIcon className="w-3 h-3" /> SIREN
                                </button>
                                <button
                                  onClick={() =>
                                    handleVehicleControl("RESET", d.vehicleId)
                                  }
                                  className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1"
                                >
                                  <ArrowPathIcon className="w-3 h-3" /> RESET
                                </button>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      )
                  )}
                </MapContainer>
              )}
            </div>
          </div>

          {/* RIGHT: LIST & CHART (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6 h-full">
            {/* Vehicle Status List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-700">Vehicle Controls</h3>
                <span className="text-xs font-mono bg-white px-2 py-1 rounded border text-slate-500">
                  {stats.totalVehicles} Connected
                </span>
              </div>

              <div className="overflow-y-auto p-4 space-y-3 flex-1 custom-scrollbar">
                {uniqueVehicles.map((v) => (
                  <div
                    key={v._id}
                    className={`p-3 rounded-xl border transition-all duration-300 ${
                      v.isDrowsy && !acknowledged[v.vehicleId]
                        ? "bg-red-50 border-red-200 shadow-sm ring-2 ring-red-100"
                        : v.isDrowsy && acknowledged[v.vehicleId]
                        ? "bg-orange-50 border-orange-200"
                        : "bg-white border-slate-100 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-slate-800">
                          {v.vehicleId}
                        </h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <UserIcon className="w-3 h-3" /> {v.driver?.name}
                        </p>
                      </div>
                      {v.isDrowsy ? (
                        v.isDrowsy && !acknowledged[v.vehicleId] ? (
                          <span className="animate-pulse bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg shadow-red-300">
                            DROWSY
                          </span>
                        ) : (
                          <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            <CheckCircleIcon className="w-3 h-3" /> ACKNOWLEDGED
                          </span>
                        )
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 mt-2 bg-white/50 p-2 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-1">
                        <ClockIcon className="w-3 h-3 text-slate-400" />
                        {v.formattedTime}
                      </div>
                      {v.isDrowsy && (
                        <div className="font-mono text-red-600 font-bold">
                          {`Alert ~${Math.round(
                            v.secondsSinceAlert / 60
                          )}m ago`}
                        </div>
                      )}
                      <div className="font-mono font-bold">{v.speed} km/h</div>
                    </div>

                    {/* CONTROL ACTION BAR */}
                    <div className="grid grid-cols-5 gap-2 mt-3">
                      {v.isDrowsy && !acknowledged[v.vehicleId] ? (
                        <button
                          onClick={() =>
                            dispatch({
                              type: "ACKNOWLEDGE",
                              vehicleId: v.vehicleId,
                            })
                          }
                          className="col-span-2 bg-green-100 hover:bg-green-200 text-green-800 rounded text-[10px] font-bold py-1.5 flex items-center justify-center gap-1"
                          title="Acknowledge Alert"
                        >
                          <CheckCircleIcon className="w-3 h-3" /> ACK
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            handleVehicleControl("CALL", v.vehicleId)
                          }
                          className="col-span-2 bg-slate-800 hover:bg-slate-900 text-white rounded text-[10px] font-bold py-1.5 flex items-center justify-center gap-1"
                          title="Call Driver"
                        >
                          <PhoneIcon className="w-3 h-3" /> CONTACT
                        </button>
                      )}
                      <div className="col-span-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() =>
                            handleVehicleControl("TRIGGER_ALARM", v.vehicleId)
                          }
                          className="bg-orange-100 hover:bg-orange-200 text-orange-700 rounded text-[10px] font-bold flex items-center justify-center"
                          title="Trigger Siren"
                        >
                          <SpeakerWaveIcon className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() =>
                            handleVehicleControl("KILL_ENGINE", v.vehicleId)
                          }
                          className="bg-red-100 hover:bg-red-200 text-red-700 rounded text-[10px] font-bold flex items-center justify-center"
                          title="Emergency Stop"
                        >
                          <PowerIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 h-48 p-4 flex flex-col">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">
                Speed Trend & Alerts
              </h3>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient
                        id="colorSpeed"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="speed"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#colorSpeed)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Global CSS Inject */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
        }
        .leaflet-popup-content {
          margin: 0;
          padding: 12px;
        }

        @keyframes pulse-red {
          0% {
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(220, 38, 38, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0);
          }
        }
        .leaflet-marker-drowsy {
          animation: pulse-red 1.5s infinite;
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}
