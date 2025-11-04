import express from "express";
import cors from "cors";
import "dotenv/config";
import authRoutes from "./routes/authRoutes.js";
import { connectDB } from "./lib/db.js";
import jobRoutes from "./routes/jobRoutes.js";
import property from "./routes/property.js";
import savedAdsRoutes from "./routes/savedAds.js";




const app = express();
const PORT = process.env.PORT || 3000;



// 🔹 تنظیمات CORS
const corsOptions = {
  origin: ["https://dastnevis.site"], 
  // می‌تونی چندتا Origin بدی: یکی برای پروداکشن (دامنه اصلی) و یکی برای حالت توسعه
  methods: ["GET", "POST", "PUT", "DELETE"],
};


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors(corsOptions));
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/properties", property); // 🔹 اضافه شد
app.use("/api/saved-ads", savedAdsRoutes);




app.listen(PORT, ()=> {
    console.log(`server is running on port ${PORT}`);
    connectDB();
});