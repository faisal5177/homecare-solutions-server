const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
const allowedOrigins = ['http://localhost:5173'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8kzkr.mongodb.net/homecareSolutions?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to MongoDB!');

    const db = client.db('homecareSolutions');
    const servicesCollection = db.collection('services');
    const bookingsCollection = db.collection('bookings');

    // Root
    app.get('/', (req, res) => {
      res.send('Homecare Solutions Server is Running!');
    });

    // 🔹 Get all services (with count)
    app.get('/services', async (req, res) => {
      const { email } = req.query;
      const query = email ? { provider_email: email } : {};
      const services = await servicesCollection.find(query).toArray();

      const servicesWithCounts = await Promise.all(
        services.map(async (service) => {
          const count = await bookingsCollection.countDocuments({
            service_id: service._id.toString(),
          });
          return { ...service, bookingCount: count };
        })
      );

      res.json(servicesWithCounts);
    });

    // 🔹 Get single service by ID
    app.get('/services/:id', async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id))
        return res.status(400).send({ message: 'Invalid ID' });

      const service = await servicesCollection.findOne({
        _id: new ObjectId(id),
      });
      service
        ? res.send(service)
        : res.status(404).send({ message: 'Service not found' });
    });

    // 🔹 Create a new service
    app.post('/services', async (req, res) => {
      const newService = req.body;
      const result = await servicesCollection.insertOne(newService);
      result.insertedId
        ? res.status(201).json({ serviceId: result.insertedId })
        : res.status(400).json({ error: 'Service creation failed' });
    });

    // 🔹 Get user-created services by provider email
    app.get('/user-services', async (req, res) => {
      const { email } = req.query;
      if (!email) return res.status(400).send({ message: 'Email is required' });

      const services = await servicesCollection
        .find({ provider_email: email })
        .toArray();
      res.send(services);
    });

    // 🔹 Update a service
    app.patch('/services/:id', async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;

      if (!ObjectId.isValid(id))
        return res.status(400).send({ message: 'Invalid service ID' });

      const result = await servicesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );

      result.modifiedCount > 0
        ? res.send({ message: 'Service updated successfully' })
        : res.status(404).send({ message: 'Service not found' });
    });

    // 🔹 Delete a service
    app.delete('/services/:id', async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id))
        return res.status(400).send({ message: 'Invalid service ID' });

      const result = await servicesCollection.deleteOne({
        _id: new ObjectId(id),
      });

      result.deletedCount > 0
        ? res.send({ message: 'Service deleted successfully' })
        : res.status(404).send({ message: 'Service not found' });
    });

    // 🔹 Book a service
    app.post('/bookings', async (req, res) => {
      const bookingData = req.body;

      bookingData.status = 'Pending';
      bookingData.createdAt = new Date().toISOString();
      bookingData.updatedAt = new Date().toISOString();
      bookingData.service_id = bookingData.service_id.toString(); // 👈 Ensure it's string
      bookingData.user_email = bookingData.user_email.toString();

      const result = await bookingsCollection.insertOne(bookingData);
      res.send(result);
    });

    // 🔹 Get bookings by user email
    app.get('/bookings', async (req, res) => {
      const { email } = req.query;
      if (!email) return res.status(400).send({ message: 'Email is required' });

      const bookings = await bookingsCollection
        .find({ user_email: email })
        .toArray();
      res.send(bookings);
    });

    // 🔹 Get bookings for a service by service_id
    app.get('/service-bookings/services/:service_id', async (req, res) => {
      const { service_id } = req.params;

      try {
        const bookings = await bookingsCollection
          .find({ service_id })
          .toArray();

        if (bookings.length > 0) {
          res.json(bookings); // Send bookings data as the response
        } else {
          res
            .status(404)
            .json({ message: 'No bookings found for this service' });
        }
      } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ message: 'Failed to fetch bookings' });
      }
    });

    // 🔹 Get enriched bookings (for MyBookedServices)
    app.get('/enriched-bookings', async (req, res) => {
      const { email } = req.query;
      if (!email) return res.status(400).send({ message: 'Email is required' });

      const bookings = await bookingsCollection
        .find({ user_email: email })
        .toArray();

      const enriched = await Promise.all(
        bookings.map(async (booking) => {
          const service = await servicesCollection.findOne({
            _id: new ObjectId(booking.service_id),
          });

          return {
            ...booking,
            name: service?.service_name || 'Unknown Service',
            location: service?.service_area || 'N/A',
            image: service?.service_image || 'https://placehold.co/150',
            company: service?.service_provider?.name || 'Unknown',
            price: service?.price || booking?.price || 'N/A',
            status: booking.status || 'Pending',
          };
        })
      );

      res.send(enriched);
    });

    // 🔹 Update booking status
    app.patch('/bookings/:id', async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      if (!ObjectId.isValid(id))
        return res.status(400).send({ message: 'Invalid booking ID' });

      const result = await bookingsCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { status, updatedAt: new Date().toISOString() } },
        { returnDocument: 'after' }
      );

      result?.value
        ? res.send({
            message: 'Booking status updated',
            updatedBooking: result.value,
          })
        : res.status(404).send({ message: 'Booking not found' });
    });

    // 🔹 Delete booking
    app.delete('/bookings/:id', async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id))
        return res.status(400).send({ message: 'Invalid booking ID' });

      const result = await bookingsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      result.deletedCount > 0
        ? res.send({ message: 'Booking deleted successfully' })
        : res.status(404).send({ message: 'Booking not found' });
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error);
  }
}

// Start server
run().then(() => {
  app.listen(port, () => {
    console.log(`Service is running on port: ${port}`);
  });
});
