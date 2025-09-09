import express from "express";
import cors from "cors";
import "dotenv/config";
import authRoutes from "./routes/authRoutes.js"
import { connectDB } from "./lib/db.js";
import bookRoutes from "./routes/bookRoutes.js"


const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.json());
app.use(cors());
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);




app.listen(PORT, ()=> {
    console.log(`server is running on port ${PORT}`);
    connectDB();
});