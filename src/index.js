// require("dotenv").config({path: "./.env"});

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

import connectDB from "./db/index.js";
import app from "./app.js";
import { configureCloudinary } from "./utils/cloudinary.js";

configureCloudinary();

const port = process.env.PORT || 8000;

connectDB()
  .then(() => {
    //Listening to express server
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  });

// Other approach to connect to MongoDB and start Express server
// import mongoose from "mongoose";
// import {DB_NAME} from "./constant.js";
// import express from "express";

// const app = express();

// (async () => {
//     try {
//         await mongoose.connect(process.env.MONGODB_URI);
//         app.on("error", (error) => {
//             console.error("Error occurred:", error);
//         });

//         app.listen(process.env.PORT, () => {
//             console.log(`Server is running on port ${process.env.PORT}`);
//         });
//     } catch (error) {
//         console.error("Error connecting to MongoDB:", error);
//         throw error;
//     }
// })();
