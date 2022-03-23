//  "dependencies": {
//         "body-parser": "^1.19.0",
//         "cors": "^2.8.5",
//         "dotenv": "^10.0.0",
//         "express": "^4.17.1",
//         "mongodb": "^4.1.3"
//       }

const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const bodyParser = require("body-parser");
const { use } = require("express/lib/router");
require("dotenv").config();
const admin = require("firebase-admin");
const ObjectId = require("mongodb").ObjectId;

const stripe = require("stripe")(
  "sk_test_51JwATpBeJgHWBnvd5PSSwM3LUzBIm6qwwm6QtIZ6uChEH6yBI55Ot1JYSbYXZcO4S7UBrtKXeHJEpON2RayUGCFL00bGDdZQTX"
);

const app = express();
const port = process.env.PORT || 5000;
//midle ware
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

//doctor-portal-2-firebase-adminsdk.json

const serviceAccount = require("./doctor-portal-2-firebase-adminsdk.json");

async function verifyToken(req, res, next) {
  if (req?.headers?.authorization) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }

  next();
}

// verifyToken();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri =
  "mongodb+srv://DoctorPortal-2:tZSJRqwGnjVb427S@cluster0.10ktf.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    await client.connect();

    const database = client.db("doctorPortals-2");
    const appoinmentCollaction = database.collection("appoinment");
    const userCollaction = database.collection("users");

    //save user
    app.post("/users", async (req, res) => {
      const doc = req.body;
      const result = await userCollaction.insertOne(doc);
      res.json(result);
      // console.log(result);
    });

    //save user (updet or insert)
    app.put("/users", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollaction.updateOne(filter, updateDoc, options);
      res.json(result);
      // console.log(result);
    });

    //set a user as admin
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      // console.log("put", req.headers.authorization);
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await userCollaction.findOne({
          email: requester,
        });
        if (requesterAccount.role === "Admin") {
          const filter = { email: user.email };
          const updateDoc = {
            $set: {
              role: "Admin",
            },
          };
          const result = await userCollaction.updateOne(filter, updateDoc);
          res.json(result);
        } else {
          res.status(403).json({ message: "your not permiton" });
        }
      }
    });

    // get login user appointment
    app.get("/appoitnment", async (req, res) => {
      const email = req.query.email;
      const date = new Date(req.query.date).toLocaleDateString();
      // console.log(date);
      const query = { email: email, date: date };
      const cursor = appoinmentCollaction.find(query);
      const appoitnment = await cursor.toArray();
      res.json(appoitnment);
      // console.log(appoitnment);
    });

    //get all appoitment
    app.get("/appoitnments", async (req, res) => {
      const cursor = appoinmentCollaction.find({});
      const appoitnment = await cursor.toArray();
      res.json(appoitnment);
    });

    //payment
    app.put("/appointment/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          payment: payment,
        },
      };
      const result = await appoinmentCollaction.updateOne(filter, updateDoc);
      res.json(result);
    });

    //single appointment data for payment
    app.get("/appoitnments/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(req.body);
      // console.log(id);
      const query = { _id: ObjectId(id) };
      const result = await appoinmentCollaction.findOne(query);
      res.json(result);
    });

    //check admin
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      const query = { email: email };
      const user = await userCollaction.findOne(query);
      let isAdmin = false;
      if (user?.role == "Admin") {
        isAdmin = true;
      }
      res.json({ isAdmin });
      // console.log(isAdmin );
    });

    //appointment
    app.post("/appoinment", async (req, res) => {
      const appoinment = req.body;
      const result = await appoinmentCollaction.insertOne(appoinment);
      // console.log(result);
      res.json(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo.price * 100;
      // console.log(amount);

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //paymet
    // app.post("/create-payment-intent", async (req, res) => {
    //   const paymentInfo = req.body;
    //   const amount = paymentInfo.price * 100;

    //   // Create a PaymentIntent with the order amount and currency
    //   const paymentIntent = await stripe.paymentIntents.create({
    //     amount: amount,
    //     currency: "usd",
    //     payment_method_types: ["card"],
    //   });

    //   res.json({
    //     clientSecret: paymentIntent.client_secret,
    //   });
    // });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("the server is okk too......");
});
app.listen(port, () => {
  console.log("the port is right", port);
});
