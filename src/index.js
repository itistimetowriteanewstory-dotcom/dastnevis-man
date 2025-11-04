import express from "express";
import cors from "cors";
import "dotenv/config";
import authRoutes from "./routes/authRoutes.js";
import { connectDB } from "./lib/db.js";
import jobRoutes from "./routes/jobRoutes.js";
import property from "./routes/property.js";
import savedAdsRoutes from "./routes/savedAds.js";
import rateLimit from "express-rate-limit";



const app = express();
const PORT = process.env.PORT || 3000;

// محدودیت سخت فقط برای ثبت‌نام و ورود
const authLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // بازه زمانی: ۲۴ ساعت
  max: 5, // حداکثر ۵ درخواست در این بازه
  message: "تعداد تلاش‌های ورود/ثبت‌نام بیش از حد مجاز است، لطفاً فردا دوباره امتحان کنید."
});

// 🔹 تنظیمات CORS
const corsOptions = {
  origin: ["https://dastnevis.site"], 
  // می‌تونی چندتا Origin بدی: یکی برای پروداکشن (دامنه اصلی) و یکی برای حالت توسعه
  methods: ["GET", "POST", "PUT", "DELETE"],
};


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors(corsOptions));
app.use("/api/auth/login", loginLimiter, loginRoute);
app.use("/api/auth/register", registerLimiter, registerRoute);
app.use("/api/auth/refresh", refreshRoute);
app.use("/api/jobs", jobRoutes);
app.use("/api/properties", property); // 🔹 اضافه شد
app.use("/api/saved-ads", savedAdsRoutes);




app.listen(PORT, ()=> {
    console.log(`server is running on port ${PORT}`);
    connectDB();
});