"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic"; // Required for Map in Next.js
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  TruckIcon,
  BellAlertIcon,
  ClockIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  MoonIcon,
  CalendarDaysIcon,
  MapPinIcon,
} from "@heroicons/react/24/solid";

// --- FIX 1: IMPORT LEAFLET CSS ---
import "leaflet/dist/leaflet.css";

// --- FIX 2: DYNAMIC IMPORT FOR MAP ---
// This prevents "window is not defined" errors in Next.js
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
// We need to import L safely for the icon
let L;
if (typeof window !== "undefined") {
  L = require("leaflet");
}

// ------------------------------------------------------------------------------------
// Helper: Custom Icon
// ------------------------------------------------------------------------------------
const getIcon = () => {
  if (!L) return null;
  return new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/743/743922.png",
    iconSize: [40, 40],
    popupAnchor: [0, -20],
    shadowUrl: null,
  });
};

// ------------------------------------------------------------------------------------
// Data Logic
// ------------------------------------------------------------------------------------
const calculateAggregates = (data) => {
  const totalVehicles = data.length;
  const totalSpeed = data.reduce((sum, d) => sum + (d.speed || 0), 0);
  const avgSpeed =
    totalVehicles > 0 ? (totalSpeed / totalVehicles).toFixed(1) : 0;
  const maxSpeed = data.reduce((max, d) => Math.max(max, d.speed || 0), 0);
  const sleepingAlertCount = data.filter((d) => d.alert === "Sleeping").length;
  const generalAlertCount = data.filter(
    (d) => d.alert && d.alert !== "Sleeping"
  ).length;

  return {
    totalVehicles,
    avgSpeed,
    maxSpeed,
    sleepingAlertCount,
    totalActiveAlerts: sleepingAlertCount + generalAlertCount,
    speedData: data
      .map((d) => ({
        time: new Date(d.timestamp * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        speed: d.speed,
      }))
      .slice(-10),
  };
};

// ------------------------------------------------------------------------------------
// UI Component: Stat Card
// ------------------------------------------------------------------------------------
const StatCard = ({ icon: Icon, title, value, unit, color, trend }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative overflow-hidden bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
  >
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {title}
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-800">{value}</span>
          {unit && (
            <span className="text-sm font-medium text-slate-500">{unit}</span>
          )}
        </div>
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace("bg-", "text-")}`} />
      </div>
    </div>
    {/* Decorative background blob */}
    <div
      className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-5 ${color}`}
    />
  </motion.div>
);

// ------------------------------------------------------------------------------------
// Main Dashboard
// ------------------------------------------------------------------------------------
export default function Dashboard() {
  // Mock Data for demonstration if API fails
  const mockData = [
    {
      _id: 1,
      vehicleId: "DHAKA-METRO-GA-12",
      speed: 45,
      gps: { lat: 23.8103, lng: 90.4125 },
      alert: null,
      timestamp: Date.now() / 1000,
    },
    {
      _id: 2,
      vehicleId: "CHATTA-METRO-HA-55",
      speed: 0,
      gps: { lat: 22.3569, lng: 91.7832 },
      alert: "Sleeping",
      timestamp: Date.now() / 1000,
    },
    {
      _id: 3,
      vehicleId: "SYLHET-METRO-KA-99",
      speed: 82,
      gps: { lat: 24.8949, lng: 91.8687 },
      alert: "Over Speed",
      timestamp: Date.now() / 1000,
    },
  ];

  const [data, setData] = useState(mockData);
  const [isClient, setIsClient] = useState(false);

  // Ensure we only render map on client side
  useEffect(() => {
    setIsClient(true);

    // Uncomment this to fetch real data
    /*
    const interval = setInterval(() => {
      fetch("/api/data")
        .then((res) => res.json())
        .then((json) => setData(json))
        .catch((e) => console.log(e));
    }, 2000);
    return () => clearInterval(interval);
    */
  }, []);

  const aggregates = useMemo(() => calculateAggregates(data), [data]);
  const vehicleIcon = useMemo(() => getIcon(), []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <TruckIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Fleet<span className="text-blue-600">Command</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              SYSTEM ONLINE
            </span>
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-xs font-bold text-slate-600">AD</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Fleet Average Speed"
            value={aggregates.avgSpeed}
            unit="km/h"
            icon={BoltIcon}
            color="bg-blue-500 text-blue-600"
          />
          <StatCard
            title="Max Speed Today"
            value={aggregates.maxSpeed}
            unit="km/h"
            icon={ExclamationTriangleIcon}
            color="bg-orange-500 text-orange-600"
          />
          <StatCard
            title="Drowsiness Alerts"
            value={aggregates.sleepingAlertCount}
            icon={MoonIcon}
            color="bg-indigo-500 text-indigo-600"
          />
          <StatCard
            title="Total Active"
            value={aggregates.totalVehicles}
            unit="Trucks"
            icon={TruckIcon}
            color="bg-emerald-500 text-emerald-600"
          />
        </div>

        {/* Split View: Map & Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
          {/* Left: Live Map (Takes up 2 columns) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative group">
            <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm border border-slate-200">
              <h2 className="font-bold text-slate-700 flex items-center gap-2">
                <MapPinIcon className="w-5 h-5 text-red-500" /> Live Tracking
              </h2>
            </div>

            {/* Map Render */}
            <div className="flex-1 w-full h-full bg-slate-100 relative">
              {/* Ensure map container has explicit height via flex-1 or explicit h- class */}
              {isClient && (
                <MapContainer
                  center={[23.8103, 90.4125]}
                  zoom={7}
                  scrollWheelZoom={true}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  />
                  {data.map((d) => (
                    <Marker
                      key={d._id}
                      position={[d.gps.lat, d.gps.lng]}
                      icon={vehicleIcon}
                    >
                      <Popup>
                        <div className="p-1">
                          <div className="font-bold text-slate-800 mb-1">
                            {d.vehicleId}
                          </div>
                          <div className="text-xs text-slate-500">
                            Speed:{" "}
                            <span className="font-semibold text-blue-600">
                              {d.speed} km/h
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Status:{" "}
                            <span
                              className={`font-bold ${
                                d.alert ? "text-red-500" : "text-green-500"
                              }`}
                            >
                              {d.alert || "Normal"}
                            </span>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              )}
            </div>
          </div>

          {/* Right: Analytics & Alerts */}
          <div className="flex flex-col gap-6 h-full">
            {/* Speed Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex-1 min-h-0 flex flex-col">
              <h3 className="text-lg font-bold text-slate-700 mb-4">
                Speed Velocity
              </h3>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={aggregates.speedData}>
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
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis dataKey="time" hide />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="speed"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorSpeed)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Alerts List */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex-1 min-h-0 overflow-hidden flex flex-col">
              <h3 className="text-lg font-bold text-slate-700 mb-4 flex justify-between items-center">
                Recent Alerts
                <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                  Live
                </span>
              </h3>
              <div className="overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {data.filter((d) => d.alert).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No active alerts
                  </p>
                )}
                {data
                  .filter((d) => d.alert)
                  .map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center p-3 bg-red-50 rounded-lg border border-red-100"
                    >
                      <BellAlertIcon className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {d.vehicleId}
                        </p>
                        <p className="text-xs text-red-600 font-medium">
                          {d.alert}
                        </p>
                      </div>
                      <div className="ml-auto text-xs text-slate-400 font-mono">
                        {new Date(d.timestamp * 1000).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
