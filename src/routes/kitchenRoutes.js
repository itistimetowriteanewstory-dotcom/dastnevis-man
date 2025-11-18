import express from "express";
import cloudinary from "../lib/cloudinary.js";
import HomeAndKitchen from "../models/HomeAndKitchen.js";   // مدل جدید خانه و آشپزخانه
import protectRoute from "../middleware/auth.middleware.js";
import User from "../models/User.js";
import { Expo } from "expo-server-sdk";

const router = express.Router();

// 📌 ایجاد آگهی خانه/آشپزخانه جدید
router.post("/", protectRoute, async (req, res) => {
  try {
    const { title, caption, image, model, status, texture, phoneNumber, dimensions, price, location, category} = req.body;

    if (!title || !caption || !image || !location || !phoneNumber) {
      return res.status(400).json({ message: "عنوان، کپشن، تصویر و موقعیت الزامی هستند" });
    }

    // آپلود تصویر به Cloudinary
    let imageUrl = null;
    if (image && typeof image === "string" && image.startsWith("data:image/")) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    // محدودیت تعداد آگهی در روز
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const countToday = await HomeAndKitchen.countDocuments({
      user: req.user._id,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    if (countToday >= 5) {
      return res.status(400).json({
        message: "شما امروز حداکثر ۵ آگهی خانه/آشپزخانه می‌توانید ثبت کنید"
      });
    }

    // ذخیره در دیتابیس
    const newHome = new HomeAndKitchen({
      title,
      caption,
      image: imageUrl || image,
      model,
      status,
      texture,
      phoneNumber,
      dimensions,
      price,
      location,
      category,
      user: req.user._id,
    });

    await newHome.save();

    // 📲 ارسال اعلان (Push Notification)
    const expo = new Expo();
    const users = await User.find({});
    const messages = [];
    const today = new Date().toDateString();

    for (const user of users) {
      if (!user.expoPushToken || !Expo.isExpoPushToken(user.expoPushToken)) continue;
      if (user._id.toString() === req.user._id.toString()) continue;

      const lastDate = user.lastNotificationDate?.toDateString();
      if (lastDate === today && user.notificationCount >= 2) continue; // محدودیت ۲ نوتیف در روز

      messages.push({
        to: user.expoPushToken,
        sound: "default",
        title: "وسایل خانه و آشپزخانه",
        body: `یک آگهی جدید "${newHome.title}" اضافه شد.`,
      });

      user.notificationCount = lastDate === today ? user.notificationCount + 1 : 1;
      user.lastNotificationDate = new Date();
      await user.save();
    }

    if (messages.length > 0) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(messages);
        console.log("Expo tickets:", ticketChunk);
      } catch (error) {
        console.error("Error sending notifications:", error);
      }
    }

    res.status(201).json(newHome);
  } catch (error) {
    console.error("error creating home/kitchen ad", error);
    res.status(500).json({ message: error.message });
  }
});

// 📌 گرفتن همه آگهی‌های خانه/آشپزخانه
router.get("/", protectRoute, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // گرفتن پارامترهای جستجو از کوئری
    const { category, title1, title2, location1, location2, location3 } = req.query;

    // ساخت فیلتر داینامیک
    const filter = {};

    if (category) {
      filter.category = { $regex: category, $options: "i" };
    }

    if (title1 || title2) {
      filter.title = {
        $in: [
          ...(title1 ? [new RegExp(title1, "i")] : []),
          ...(title2 ? [new RegExp(title2, "i")] : []),
        ],
      };
    }

    if (location1 || location2 || location3) {
      filter.location = {
        $in: [
          ...(location1 ? [new RegExp(location1, "i")] : []),
          ...(location2 ? [new RegExp(location2, "i")] : []),
          ...(location3 ? [new RegExp(location3, "i")] : []),
        ],
      };
    }

    // اجرای کوئری با فیلتر
    const homes = await HomeAndKitchen.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username profileImage");

    const total = await HomeAndKitchen.countDocuments(filter);

    res.send({
      homes,
      currentPage: page,
      totalHomes: total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("error in get all homes route", error);
    res.status(500).json({ message: "خطای سرور" });
  }
});



// 📌 حذف آگهی خانه/آشپزخانه
router.delete("/:id", protectRoute, async (req, res) => {
  try {
    const home = await HomeAndKitchen.findById(req.params.id);
    if (!home) return res.status(404).json({ message: "آگهی پیدا نشد" });

    if (home.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "دسترسی غیر مجاز" });
    }

    // حذف تصویر از Cloudinary
    if (home.image && home.image.includes("cloudinary")) {
      try {
        const publicId = home.image.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteError) {
        console.log("error deleting image from cloudinary", deleteError);
      }
    }

    await home.deleteOne();
    res.json({ message: "آگهی با موفقیت حذف شد" });
  } catch (error) {
    console.error("error deleting home", error);
    res.status(500).json({ message: "خطای سرور" });
  }
});

// 📌 گرفتن آگهی‌های کاربر لاگین کرده
router.get("/user", protectRoute, async (req, res) => {
  try {
    const homes = await HomeAndKitchen.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(homes);
  } catch (error) {
    console.error("get user homes error", error.message);
    res.status(500).json({ message: "خطای سرور" });
  }
});

export default router;

