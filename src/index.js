import express from "express";
import cors from "cors";
import "dotenv/config";
import authRoutes from "./routes/authRoutes.js"
import { connectDB } from "./lib/db.js";
import jobRoutes from "./routes/jobRoutes.js";


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);




app.listen(PORT, ()=> {
    console.log(`server is running on port ${PORT}`);
    connectDB();
});