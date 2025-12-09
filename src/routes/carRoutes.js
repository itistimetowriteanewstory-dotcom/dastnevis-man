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
    const { title, caption, images, model, brand, fuelType, phoneNumber, carcard, price, location, adType } = req.body;

    if (!title || !caption || !images || !phoneNumber || !location || !adType) {
      return res.status(400).json({ message: "عنوان، کپشن و تصویر الزامی هستند" });
    }


     let imageUrls = [];
if (images && Array.isArray(images)) {
  if (images.length > 5) {
    return res.status(400).json({ message: "حداکثر ۵ عکس مجاز است" });
  }

  for (const img of images) {
    if (typeof img === "string" && img.startsWith("data:image/")) {
      const uploadResponse = await cloudinary.uploader.upload(img);
      imageUrls.push(uploadResponse.secure_url);
    }
  }
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
      images: imageUrls,
      model,
      brand,
      fuelType,
      phoneNumber,
      carcard,
      price,
      location,
      adType,
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


router.get("/", protectRoute, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // گرفتن پارامترهای جستجو از کوئری
    const { location, model, adType, title } = req.query;

   const filter = {};
const ignoreValue = "بدون فیلتر"; // مقدار پیش‌فرض برای نادیده گرفتن

if (location && location !== ignoreValue) {
  filter.location = { $regex: location, $options: "i" };
}

if (model && model !== ignoreValue) {
  filter.model = { $regex: model, $options: "i" };
}

if (adType && adType !== ignoreValue) {
  filter.adType = { $regex: adType, $options: "i" };
}

if (title && title !== ignoreValue) {
  filter.title = { $regex: title, $options: "i" };
}


    // اجرای کوئری با فیلتر
    const cars = await Car.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username profileImage");

    const total = await Car.countDocuments(filter);

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

   // حذف همه تصاویر از Cloudinary (نسخه اول)
if (car.images && car.images.length > 0) {
  for (const img of car.images) {
    try {
      const publicId = img.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    } catch (deleteError) {
      console.log("error deleting image from cloudinary", deleteError);
    }
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