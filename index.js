require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

//  Properly set up CORS
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "DELETE"]
}));

app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8kzkr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// services related APIs
const servicesCollection = client.db('homecareSolutions').collection('services');
const serviceApplicationCollection = client.db('homecareSolutions').collection('service_applications');

async function run() {
  try {
    await client.connect();
    console.log(" Successfully connected to MongoDB!");

    app.get('/services', async (req, res) => {
      const cursor = servicesCollection.find({});
      const services = await cursor.toArray();
      res.send(services);
    });

    app.post('/services', async (req, res) => {
      const service = req.body;
      const result = await servicesCollection.insertOne(service);
      res.json(result);
    });

    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await servicesCollection.findOne(query);
      res.send(result);
    });

  } finally {
    // You can enable this when needed
    // await client.close();
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send(' Homecare Solutions server is running!');
});

app.listen(port, () => {
  console.log(` Homecare Solutions server running on port: ${port}`);
});
