const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: ["http://localhost:5173"], credentials: true }));
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8kzkr.mongodb.net/homecareSolutions?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
    console.log("Successfully connected to MongoDB!");

    // Collections
    const servicesCollection = client.db("homecareSolutions").collection("services");
    const bookingsCollection = client.db("homecareSolutions").collection("bookings");

    // Get All Services (Public)
    app.get("/services", async (req, res) => {
      const services = await servicesCollection.find().toArray();
      res.send(services);
    });

    // Get Single Service by ID
    app.get("/services/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid service ID" });

      const service = await servicesCollection.findOne({ _id: new ObjectId(id) });
      res.send(service);
    });

    // Add a New Service (Private)
    app.post('/services', async (req, res) => {
      try {
        const newService = req.body;
        console.log("Received new service:", newService); 
    
        const result = await servicesCollection.insertOne(newService);
        
        if (result.insertedId) {
          console.log("Service inserted successfully:", result.insertedId); // Debugging line
          res.status(201).json({ serviceId: result.insertedId });
        } else {
          res.status(400).json({ error: 'Service creation failed' });
        }
      } catch (error) {
        console.error("Error in adding service:", error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
    

    // Manage Services (User-Specific, Private)
    app.get("/user-services", async (req, res) => {
      const { email } = req.query;
      if (!email) return res.status(400).send({ message: "Email is required" });

      const services = await servicesCollection.find({ provider_email: email }).toArray();
      res.send(services);
    });

    // Update a Service
    app.patch("/services/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;

      if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid service ID" });

      const result = await servicesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );

      if (result.modifiedCount > 0) {
        res.send({ message: "Service updated successfully!" });
      } else {
        res.status(404).send({ message: "Service not found" });
      }
    });

    // Delete a Service
    app.delete("/services/:id", async (req, res) => {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid service ID" });

      const result = await servicesCollection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount > 0) {
        res.send({ message: "Service deleted successfully!" });
      } else {
        res.status(404).send({ message: "Service not found" });
      }
    });

    // Book a Service
    app.post('/bookings', async (req, res) => {
      const bookingData = req.body;
      bookingData.status = "pending"; // Default status
      const result = await bookingsCollection.insertOne(bookingData);
      res.send(result);
    });

    // Get User's Booked Services (Private)
    app.get("/bookings", async (req, res) => {
      const { email } = req.query;
      if (!email) return res.status(400).send({ message: "Email is required" });

      const bookings = await bookingsCollection.find({ user_email: email }).toArray();
      res.json(bookings);
    });

    // ✅ Get "Service To Do"
    app.get("/todo-services", async (req, res) => {
      const { provider_email } = req.query;
      if (!provider_email) return res.status(400).send({ message: "Provider email is required" });

      const bookings = await bookingsCollection.find({
        provider_email: { $regex: new RegExp("^" + provider_email + "$", "i") }
      }).toArray();

      res.json(bookings);
    });

    // ✅ Update Booking Status
    app.patch("/bookings/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
  
      if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid booking ID" });
  
      const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
      );
  
      if (result.modifiedCount > 0) {
          res.send({ message: "Booking status updated successfully!" });
      } else {
          res.status(404).send({ message: "Booking not found" });
      }
  });  

    // Delete Booking
    app.delete("/bookings/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid booking ID" });

      const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount > 0) {
        res.json({ message: "Booking deleted successfully!" });
      } else {
        res.status(404).json({ message: "Booking not found" });
      }
    });

    // Default Route
    app.get("/", (req, res) => {
      res.send("Homecare Solutions Server is Running!");
    });

  } catch (error) {
    console.error("nodemon index.jsError connecting to MongoDB:", error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});
