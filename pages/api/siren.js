// pages/api/siren.js
import clientPromise from "../../lib/mongodb.js";

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("drowsiness-detection");

  if (req.method === "POST") {
    try {
      const { vehicleId, command, driver } = req.body;

      // ---------- VALIDATION ----------
      if (!vehicleId || !command) {
        return res
          .status(400)
          .json({ message: "vehicleId and command are required." });
      }

      const allowedCommands = ["KILL_ENGINE", "TRIGGER_ALARM", "RESET"];

      if (!allowedCommands.includes(command)) {
        return res.status(400).json({
          message: `Invalid command. Allowed: ${allowedCommands.join(", ")}`,
        });
      }

      // ensure timestamp always exists
      const timestamp = Date.now() / 1000;

      const payload = {
        vehicleId,
        command,
        driver: driver || null,
        timestamp,
        status: "PENDING", // for future IoT confirmation
      };

      // ---------- SAVE TO DATABASE ----------
      const result = await db.collection("siren_commands").insertOne(payload);

      return res.status(201).json({
        message: "Siren command stored successfully",
        insertedId: result.insertedId,
      });
    } catch (err) {
      console.error("SIREN API ERROR:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  // ---------- GET LATEST COMMANDS ----------
  else if (req.method === "GET") {
    try {
      const commands = await db
        .collection("siren_commands")
        .find()
        .sort({ timestamp: -1 })
        .limit(20)
        .toArray();

      return res.status(200).json(commands);
    } catch (err) {
      console.error("SIREN GET ERROR:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  // ---------- INVALID METHOD ----------
  else {
    res.setHeader("Allow", ["POST", "GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
