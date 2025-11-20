import "./globals.css";

export const metadata = {
  title: "FleetGuard - AI Drowsiness Detection",
  description:
    "Live dashboard for monitoring driver drowsiness and managing fleet safety with AI-powered alerts and vehicle controls.",
  keywords:
    "FleetGuard, Fleet Management, Drowsiness Detection, AI, Vehicle Safety, GPS Tracking, Driver Monitoring",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
