// routes/savedAds.routes.js
import express from "express";
import SavedAd from "../models/SavedAd.js";
import protectRoute from "../middleware/auth.middleware.js";

const router = express.Router();

// 📌 ذخیره آگهی
router.post("/", protectRoute, async (req, res) => {
  try {
    const { adId, adType } = req.body; // 👈 adType = "job" یا "property"

    if (!adId || !adType) {
      return res.status(400).json({ message: "adId و adType الزامی هستند" });
    }

    const exists = await SavedAd.findOne({ user: req.user._id, ad: adId });
    if (exists) return res.status(400).json({ message: "قبلاً ذخیره شده" });

    const saved = new SavedAd({ user: req.user._id, ad: adId, adType });
    await saved.save();

    res.json(saved);
  } catch (error) {
    console.error("Error saving ad:", error);
    res.status(500).json({ message: "خطا در ذخیره آگهی" });
  }
});

// 📌 حذف آگهی از ذخیره‌ها
router.delete("/", protectRoute, async (req, res) => {
  try {
    const { adId } = req.body;

    if (!adId) {
      return res.status(400).json({ message: "adId الزامی است" });
    }

    await SavedAd.findOneAndDelete({ user: req.user._id, ad: adId });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting saved ad:", error);
    res.status(500).json({ message: "خطا در حذف آگهی ذخیره‌شده" });
  }
});

// 📌 گرفتن لیست ذخیره‌ها
router.get("/", protectRoute, async (req, res) => {
  try {
    const savedAds = await SavedAd.find({ user: req.user._id })
      .populate({
    path: "ad",
    populate: { path: "user", select: "username profileImage" } // 👈 اینجا
  });

 // 👈 حالا خودش می‌فهمه job یا property رو بیاره

    res.json(savedAds);
  } catch (error) {
    console.error("Error fetching saved ads:", error);
    res.status(500).json({ message: "خطا در دریافت لیست ذخیره‌ها" });
  }
});

export default router;
