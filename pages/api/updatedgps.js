// pages/api/updatedgps.js
import clientPromise from "../../lib/mongodb.js";

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("drowsiness-detection");

  if (req.method === "POST") {
    try {
      const data = req.body;

      // Validate the incoming data from the Python script
      if (!data || !data.vehicleId || !data.gps) {
        return res
          .status(400)
          .json({ message: "Missing required fields: vehicleId, gps." });
      }

      // Validate GPS data shape and values
      const lat = Number(data.gps.lat);
      const lng = Number(data.gps.lng);
      if (!isFinite(lat) || !isFinite(lng)) {
        return res
          .status(400)
          .json({ message: "Invalid GPS coordinate values." });
      }
      data.gps = { lat, lng };

      // Ensure a timestamp exists, creating one if not provided
      if (!data.timestamp) {
        data.timestamp = Date.now() / 1000; // seconds since epoch
      }

      // Insert data into a new 'gps_updates' collection
      const result = await db.collection("gps_updates").insertOne(data);

      res.status(201).json({
        message: "GPS data saved successfully",
        insertedId: result.insertedId,
      });
    } catch (e) {
      console.error("API Error:", e);
      res.status(500).json({ message: "Internal Server Error" });
    }
  } else if (req.method === "GET") {
    try {
      const data = await db
        .collection("gps_updates")
        .find()
        .sort({ timestamp: -1 })
        .limit(200) // Fetch more points for path drawing
        .toArray();
      res.status(200).json(data);
    } catch (e) {
      console.error("API Error:", e);
      res.status(500).json({ message: "Internal Server Error" });
    }
  } else {
    res.setHeader("Allow", ["POST", "GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
