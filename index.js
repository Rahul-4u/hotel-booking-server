require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookiePaser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 8000;
// -------------
const corsOptions = {
  origin: ["http://localhost:5173"],
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookiePaser());
// -----------------------------------------------------

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const moment = require("moment");
const jwt = require("jsonwebtoken");

const uri = `mongodb+srv://${process.env.BD_MASTER}:${process.env.BD_PASS}@cluster0.zs3l2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const database = client.db("hotelBD");
    const roomCollection = database.collection("room");
    const myBookingCollection = database.collection("booking");
    const rivewCollection = database.collection("rivew");
    const speciaOffersCollection = database.collection("offer");

    // ------jwt token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      // create token
      const token = jwt.sign(email, process.env.SECRET_KEY, {
        expiresIn: "30d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,

          secure: process.env.NODE_ENV === "production",

          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // ---- tokoen clear
    app.get("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",

          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // -----verifye token
    const veryfyToken = (req, res, next) => {
      const token = req.cookies?.token;
      if (!token)
        return res.status(401).send({ message: "unauthorized access" });
      jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.user = decoded;
      });
      next();
    };
    //   ----------post sectaion-------
    app.get("/", async (req, res) => {
      res.send("hello dev");
    });

    app.post("/add-room", async (req, res) => {
      const addNewRoom = req.body;
      const result = await roomCollection.insertOne(addNewRoom);

      // ----------------
      const filter = { roomId: addNewRoom.revId };
      const update = {
        $inc: { reivew: 1 },
      };

      const updateReview = await rivewCollection.updateOne(filter, update);
      res.send(result);
    });

    app.get("/add-room", async (req, res) => {
      const cursor = roomCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // -------my booking -------
    app.post("/my-booking", async (req, res) => {
      const myBooking = req.body;
      const result = await myBookingCollection.insertOne(myBooking);
      res.send(result);
    });
    app.get("/my-booking", veryfyToken, async (req, res) => {
      const cursor = myBookingCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    // --------------daynamic delete btn
    app.delete("/my-booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const booking = await myBookingCollection.findOne(query);

      // ---------
      const currentDate = moment();
      const bookingDate = moment(booking.bookingDate);
      if (bookingDate.diff(currentDate, "days") < 1) {
        return res.status(400).send({
          message: " uff ! Booking cannot be canceled less than 1 day before.",
        });
      }
      const result = await myBookingCollection.deleteOne(query);
      res.send(result);
    });

    // ---update card------
    app.get("/my-booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await myBookingCollection.findOne(query);
      res.send(result);
    });

    app.put("/my-booking/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedBooking = req.body;
      const user = {
        $set: {
          name: updatedBooking.name,
          price: updatedBooking.price,
          bookingDate: updatedBooking.bookingDate,
          roomtyp: updatedBooking.roomtyp,
        },
      };
      const result = await myBookingCollection.updateOne(filter, user, options);
      res.send(result);
    });
    //   ----------------------------------
    // app.post("/visa", async (req, res) => {
    //   const addNewVisa = req.body;
    //   // console.log("Adding new coffee", addNewVisa);

    //   const result = await visaCollection.insertOne(addNewVisa);
    //   res.send(result);
    // });

    // ---------Rivew collection---------

    app.post("/rivew", veryfyToken, async (req, res) => {
      const addNewrivew = req.body;
      addNewrivew.email = req.user?.email;
      addNewrivew.createdAt = new Date();
      const result = await rivewCollection.insertOne(addNewrivew);
      res.send(result);
    });
    app.get("/all-rivew", async (req, res) => {
      const cursor = rivewCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    // app.get("/rivew", async (req, res) => {
    //   const { revId } = req.query;

    //   if (revId) {
    //     query = { revId: revId };
    //   }

    //   try {
    //     const cursor = rivewCollection.find(query);
    //     const result = await cursor.toArray();
    //     res.send(result);
    //   } catch (error) {
    //     console.error("Error fetching reviews:", error);
    //     res.status(500).send({ message: "Failed to fetch reviews" });
    //   }
    // });

    // Assuming you're using Express on the backend
    app.get("/rivew", async (req, res) => {
      const { roomId } = req.query; // Get roomId from query params
      console.log("Received roomId:", roomId); // Log roomId

      try {
        let query = {};
        if (roomId) {
          query = { roomId: roomId }; // Filter by roomId
        }

        const reviews = await rivewCollection.find(query).toArray();
        console.log("Fetched reviews:", reviews); // Log fetched reviews
        res.status(200).send(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).send({ message: "Failed to fetch reviews" });
      }
    });

    app.get("/filter-rivew", async (req, res) => {
      const result = await rivewCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });
    // ---------home featuer card-------------
    app.get("/featured-rooms", async (req, res) => {
      const result = await roomCollection
        .find()
        .sort({ rating: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // -----------------offer server------
    app.post("/add-offer", async (req, res) => {
      const newOffer = req.body;
      const result = await speciaOffersCollection.insertOne(newOffer);
      res.send(result);
    });
    app.get("/offer", async (req, res) => {
      const cursor = speciaOffersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// -----------------------------------------------------
app.listen(port, () => {
  console.log(`hotel server is running on port ${port}`);
});
