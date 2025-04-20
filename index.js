const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
const allowedOrigins = ['http://localhost:5173'];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS not allowed'));
    },
    credentials: true,
  })
);
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
    console.log('✅ Connected to MongoDB');

    const db = client.db('homecareSolutions');
    const servicesCollection = db.collection('services');
    const bookingsCollection = db.collection('bookings');

    // Root
    app.get('/', (req, res) => {
      res.send('Homecare Solutions Server is Running!');
    });

    // Get all services
    app.get('/services', async (req, res) => {
      try {
        const services = await servicesCollection.find().toArray();
        res.send(services);
      } catch {
        res.status(500).send({ message: 'Error fetching services' });
      }
    });

    // Get a single service by ID
    app.get('/services/:id', async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).send({ message: 'Invalid ID' });

      try {
        const service = await servicesCollection.findOne({ _id: new ObjectId(id) });
        service ? res.send(service) : res.status(404).send({ message: 'Service not found' });
      } catch {
        res.status(500).send({ message: 'Error fetching service' });
      }
    });

    // Create a new service
    app.post('/services', async (req, res) => {
      try {
        const newService = req.body;
        const result = await servicesCollection.insertOne(newService);
        result.insertedId
          ? res.status(201).json({ serviceId: result.insertedId })
          : res.status(400).json({ error: 'Service creation failed' });
      } catch {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Get services by provider email
    app.get('/user-services', async (req, res) => {
      const { email } = req.query;
      if (!email) return res.status(400).send({ message: 'Email is required' });

      try {
        const services = await servicesCollection.find({ provider_email: email }).toArray();
        res.send(services);
      } catch {
        res.status(500).send({ message: 'Error fetching user services' });
      }
    });

    // Update a service
    app.patch('/services/:id', async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;

      if (!ObjectId.isValid(id)) return res.status(400).send({ message: 'Invalid service ID' });

      try {
        const result = await servicesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );
        result.modifiedCount > 0
          ? res.send({ message: 'Service updated successfully' })
          : res.status(404).send({ message: 'Service not found' });
      } catch {
        res.status(500).send({ message: 'Error updating service' });
      }
    });

    // Delete a service
    app.delete('/services/:id', async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).send({ message: 'Invalid service ID' });

      try {
        const result = await servicesCollection.deleteOne({ _id: new ObjectId(id) });
        result.deletedCount > 0
          ? res.send({ message: 'Service deleted successfully' })
          : res.status(404).send({ message: 'Service not found' });
      } catch {
        res.status(500).send({ message: 'Error deleting service' });
      }
    });

    // Book a service
    app.post('/bookings', async (req, res) => {
      const bookingData = req.body;
      bookingData.status = 'Pending';

      try {
        const result = await bookingsCollection.insertOne(bookingData);
        res.send(result);
      } catch {
        res.status(500).send({ message: 'Error creating booking' });
      }
    });

    // Get bookings by user email
    app.get('/bookings', async (req, res) => {
      const { email } = req.query;
      if (!email) return res.status(400).send({ message: 'Email is required' });

      try {
        const bookings = await bookingsCollection.find({ user_email: email }).toArray();
        res.send(bookings);
      } catch {
        res.status(500).send({ message: 'Error fetching bookings' });
      }
    });

    // Get bookings by service ID
    app.get('/bookings-by-service', async (req, res) => {
      const { serviceId } = req.query;
      if (!serviceId) return res.status(400).send({ message: 'Service ID is required' });

      try {
        const bookings = await bookingsCollection.find({ service_id: serviceId }).toArray();
        res.send(bookings);
      } catch {
        res.status(500).send({ message: 'Error fetching service bookings' });
      }
    });

    // Get enriched bookings by user email
    app.get('/enriched-bookings', async (req, res) => {
      const { email } = req.query;
      if (!email) return res.status(400).send({ message: 'Email is required' });

      try {
        const bookings = await bookingsCollection.find({ user_email: email }).toArray();

        const enrichedBookings = await Promise.all(
          bookings.map(async (booking) => {
            try {
              const service = await servicesCollection.findOne({
                _id: new ObjectId(booking.service_id),
              });

              return service
                ? {
                    ...booking,
                    name: service.service_name,
                    location: service.service_area,
                    image: service.service_image,
                    company: service?.service_provider?.name || 'Unknown',
                  }
                : {
                    ...booking,
                    name: 'Service not found',
                    location: 'N/A',
                    image: 'https://placehold.co/150',
                    company: 'Unknown',
                  };
            } catch {
              return booking;
            }
          })
        );

        res.send(enrichedBookings);
      } catch {
        res.status(500).send({ message: 'Error enriching service bookings' });
      }
    });

    // Update booking status
    app.patch('/bookings/:id', async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ['Pending', 'In Progress', 'Completed', 'Cancelled'];

      if (!validStatuses.includes(status))
        return res.status(400).send({ message: 'Invalid status value' });

      if (!ObjectId.isValid(id)) return res.status(400).send({ message: 'Invalid booking ID' });

      try {
        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );
        result.modifiedCount > 0
          ? res.send({ message: 'Booking status updated' })
          : res.status(404).send({ message: 'Booking not found' });
      } catch {
        res.status(500).send({ message: 'Error updating booking status' });
      }
    });

    // Delete booking
    app.delete('/bookings/:id', async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id))
        return res.status(400).send({ message: 'Invalid booking ID' });

      try {
        const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
        result.deletedCount > 0
          ? res.send({ message: 'Booking deleted successfully' })
          : res.status(404).send({ message: 'Booking not found' });
      } catch {
        res.status(500).send({ message: 'Error deleting booking' });
      }
    });
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
  }
}

// Start server
run().then(() => {
  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
});
