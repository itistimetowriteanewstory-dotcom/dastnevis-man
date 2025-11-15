import express from "express";
import cloudinary from "../lib/cloudinary.js";
import Car from "../models/Car.js";   // مدل جدید خودرو
import protectRoute from "../middleware/auth.middleware.js";
import User from "../models/User.js";
import { Expo } from "expo-server-sdk";

const router = express.Router();

// 📌 ایجاد آگهی خودرو جدید
router.post("/", protectRoute, async (req, res) => {
  try {
    const { title, caption, image, model, brand, fuelType, phoneNumber, carcard, price, location } = req.body;

    if (!title || !caption || !image || !phoneNumber || !location) {
      return res.status(400).json({ message: "عنوان، کپشن و تصویر الزامی هستند" });
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

    const countToday = await Car.countDocuments({
      user: req.user._id,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    if (countToday >= 5) {
      return res.status(400).json({
        message: "شما امروز حداکثر ۵ آگهی خودرو می‌توانید ثبت کنید"
      });
    }

    // ذخیره در دیتابیس
    const newCar = new Car({
      title,
      caption,
      image: imageUrl || image,
      model,
      brand,
      fuelType,
      phoneNumber,
      carcard,
      price,
      location,
      user: req.user._id,
    });

    await newCar.save();

    // 📲 ارسال اعلان (Push Notification)
    const expo = new Expo();
    const users = await User.find({});
    const messages = [];
    const today = new Date().toDateString();

    for (const user of users) {
      if (!user.expoPushToken || !Expo.isExpoPushToken(user.expoPushToken)) continue;
      if (user._id.toString() === req.user._id.toString()) continue;

      const lastDate = user.lastNotificationDate?.toDateString();
      if (lastDate === today && user.notificationCount >= 2) continue;

      messages.push({
        to: user.expoPushToken,
        sound: "default",
        title: "آگهی جدیدی برای وسایل نقلیه ثبت شد",
        body: `یک آگهی جدید "${newCar.title}" اضافه شد.`,
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

    res.status(201).json(newCar);
  } catch (error) {
    console.error("error creating car", error);
    res.status(500).json({ message: error.message });
  }
});

// 📌 گرفتن همه آگهی‌های خودرو
router.get("/", protectRoute, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const cars = await Car.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username profileImage");

    const total = await Car.countDocuments();

    res.send({
      cars,
      currentPage: page,
      totalCars: total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("error in get all cars route", error);
    res.status(500).json({ message: "خطای سرور" });
  }
});

// 📌 حذف آگهی خودرو
router.delete("/:id", protectRoute, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: "خودرو پیدا نشد" });

    if (car.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "دسترسی غیر مجاز" });
    }

    // حذف تصویر از Cloudinary
    if (car.image && car.image.includes("cloudinary")) {
      try {
        const publicId = car.image.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteError) {
        console.log("error deleting image from cloudinary", deleteError);
      }
    }

    await car.deleteOne();
    res.json({ message: "خودرو با موفقیت حذف شد" });
  } catch (error) {
    console.error("error deleting car", error);
    res.status(500).json({ message: "خطای سرور" });
  }
});

// 📌 گرفتن آگهی‌های کاربر لاگین کرده
router.get("/user", protectRoute, async (req, res) => {
  try {
    const cars = await Car.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(cars);
  } catch (error) {
    console.error("get user cars error", error.message);
    res.status(500).json({ message: "خطای سرور" });
  }
});

export default router;