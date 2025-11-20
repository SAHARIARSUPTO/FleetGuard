// pages/api/data.js
import clientPromise from "../../lib/mongodb.js";

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("drowsiness-detection");

  if (req.method === "POST") {
    try {
      const data = req.body;

      if (
        !data ||
        !data.vehicleId ||
        typeof data.speed === "undefined" ||
        !data.gps
      ) {
        return res
          .status(400)
          .json({ message: "Missing required vehicle data fields." });
      }

      // validate GPS shape
      const lat = Number(data.gps.lat);
      const lng = Number(data.gps.lng);
      if (!isFinite(lat) || !isFinite(lng)) {
        return res.status(400).json({ message: "Invalid GPS values." });
      }
      data.gps = { lat, lng };

      // driver info is optional but we warn
      if (!data.driver || !data.driver.id || !data.driver.name) {
        console.warn(
          "Received data without complete driver information:",
          data
        );
        // optionally: return 400 if you want to enforce driver info strictly
      }

      // ensure timestamp exists
      if (!data.timestamp) {
        data.timestamp = Date.now() / 1000; // seconds epoch
      }

      const result = await db.collection("data").insertOne(data);

      res.status(201).json({
        message: "Data saved successfully",
        insertedId: result.insertedId,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Internal Server Error" });
    }
  } else if (req.method === "GET") {
    try {
      const data = await db
        .collection("data")
        .find()
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();
      res.status(200).json(data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Internal Server Error" });
    }
  } else {
    res.setHeader("Allow", ["POST", "GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
