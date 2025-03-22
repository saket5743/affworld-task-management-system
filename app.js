const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const session = require('express-session');


const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}))

app.use(session({
  resave: false,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET 
}))

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(bodyParser.json());

// Route Imports

const userRoute = require("./routes/user.routes");
const taskRoute = require("./routes/task.routes");
const postRoute = require('./routes/post.routes');

// Routes Declearation

app.use("/api/v1/users", userRoute);
app.use("/api/v1/task", taskRoute);
app.use("/api/v1/post", postRoute);


// basic route 
const ApiResponse = require("./utils/ApiResponse");
app.get("/", async (req, resp) => {
  return resp
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "app is running fine"
      )
    )
});

module.exports = { app };