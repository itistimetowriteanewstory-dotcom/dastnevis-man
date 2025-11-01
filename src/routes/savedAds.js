import express from "express";
import SavedAd from "../models/SavedAd.js";
import protectRoute from "../middleware/auth.middleware.js";

const router = express.Router();

// ذخیره آگهی
router.post("/", protectRoute, async (req, res) => {
  const { adId } = req.body;

  const exists = await SavedAd.findOne({ user: req.user._id, ad: adId });
  if (exists) return res.status(400).json({ message: "قبلاً ذخیره شده" });

  const saved = new SavedAd({ user: req.user._id, ad: adId });
  await saved.save();

  res.json(saved);
});

// حذف آگهی از ذخیره‌ها
router.delete("/", protectRoute, async (req, res) => {
  const { adId } = req.body;

  await SavedAd.findOneAndDelete({ user: req.user._id, ad: adId });

  res.json({ success: true });
});

// گرفتن لیست ذخیره‌ها
router.get("/", protectRoute, async (req, res) => {
  const savedAds = await SavedAd.find({ user: req.user._id }).populate("ad");
  res.json(savedAds);
});

export default router;