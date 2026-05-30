import express from "express";
import cloudinary from "../lib/cloudinary.js";
import Car from "../models/Car.js";   // مدل جدید موتر
import protectRoute from "../middleware/auth.middleware.js";
import User from "../models/User.js";
import { Expo } from "expo-server-sdk";
  const expo = new Expo();
const router = express.Router();

// 📌 ایجاد آگهی موتر جدید
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
        message: "شما امروز حداکثر ۵ آگهی موتر می‌توانید ثبت کنید"
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

// پاسخ سریع به فرانت
res.status(201).json(newCar);

// ارسال نوتیف در پس‌زمینه
(async () => {
  try {
    const today = new Date().toDateString();

    const users = await User.find({
      expoPushToken: { $exists: true, $ne: null }
    }).select(
      "_id expoPushToken lastNotificationDate"
    );

    const messages = [];
    const bulkUpdates = [];

    for (const user of users) {

      // به ثبت کننده آگهی ارسال نشود
      if (user._id.toString() === req.user._id.toString()) {
        continue;
      }

      // اعتبارسنجی توکن
      if (
        !user.expoPushToken ||
        !Expo.isExpoPushToken(user.expoPushToken)
      ) {
        continue;
      }

      const lastDate =
        user.lastNotificationDate?.toDateString();

      // فقط یک بار در روز
      if (lastDate === today) {
        continue;
      }

      messages.push({
        to: user.expoPushToken,
        sound: "default",
        title: "آگهی‌های جدید خودرو",
        body: "امروز آگهی‌های جدیدی در بخش خودرو ثبت شده‌اند.",
      });

      bulkUpdates.push({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              lastNotificationDate: new Date(),
            },
          },
        },
      });
    }

    // بروزرسانی گروهی کاربران
    if (bulkUpdates.length > 0) {
      await User.bulkWrite(bulkUpdates);
    }

    // ارسال گروهی به Expo
    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        console.error("Expo chunk error:", err);
      }
    }


  } catch (error) {
    console.error("Notification error:", error);
  }
})();

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



// 📌 حذف آگهی موتر
router.delete("/:id", protectRoute, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: "موتر پیدا نشد" });

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
    res.json({ message: "موتر با موفقیت حذف شد" });
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

// update car
router.put("/:id", protectRoute, async (req, res) => {
  try {
    const { 
      title, caption, images, model, brand, fuelType, phoneNumber, carcard, price, location, adType 
    } = req.body;

    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: "موتر پیدا نشد" });

    // فقط صاحب آگهی اجازه ویرایش دارد
    if (car.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "دسترسی غیر مجاز" });
    }

    let imageUrls = car.images || [];

// اگر تصاویر جدید فرستاده شده باشند
if (images && Array.isArray(images)) {
  if (images.length > 5) {
    return res.status(400).json({ message: "حداکثر ۵ عکس مجاز است" });
  }

  // 🔹 پیدا کردن عکس‌هایی که کاربر حذف کرده
  const newImageSet = new Set(images);
  const removedImages = imageUrls.filter(img => !newImageSet.has(img));

  // 🔹 فقط عکس‌های حذف‌شده رو از Cloudinary پاک کن
  for (const img of removedImages) {
    try {
      const publicId = img.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    } catch (deleteError) {
      console.log("error deleting old image from cloudinary", deleteError);
    }
  }

  // 🔹 ساخت لیست جدید تصاویر
  imageUrls = [];
  for (const img of images) {
    if (typeof img === "string" && img.startsWith("data:image/")) {
      const uploadResponse = await cloudinary.uploader.upload(img);
      imageUrls.push(uploadResponse.secure_url); // فقط لینک ذخیره میشه
    } else if (typeof img === "string" && img.startsWith("http")) {
      imageUrls.push(img); // لینک قبلی نگه داشته میشه
    }
  }
}


    // بروزرسانی فیلدها
    car.title = title || car.title;
    car.caption = caption || car.caption;
    car.images = imageUrls;
    car.model = model || car.model;
    car.brand = brand || car.brand;
    car.fuelType = fuelType || car.fuelType;
    car.phoneNumber = phoneNumber || car.phoneNumber;
    car.carcard = carcard || car.carcard;
    car.price = price || car.price;
    car.location = location || car.location;
    car.adType = adType || car.adType;

    await car.save();

    res.json({ message: "آگهی موتر با موفقیت بروزرسانی شد", car });
  } catch (error) {
    console.error("error updating car", error);
    res.status(500).json({ message: "خطای سرور لطفا بعدا امتحان کنید" });
  }
});

// get car by id
router.get("/:id", protectRoute, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id).populate("user", "username profileImage");
    if (!car) return res.status(404).json({ message: "موتر پیدا نشد" });

    res.json(car);
  } catch (error) {
    console.error("error fetching car", error);
    res.status(500).json({ message: "خطای سرور لطفا بعدا امتحان کنید" });
  }
});


export default router;