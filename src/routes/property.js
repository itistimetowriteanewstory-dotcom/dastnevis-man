import express from "express";
import cloudinary from "../lib/cloudinary.js";
import Property from "../models/properties.js";   // مدل جدید املاک
import protectRoute from "../middleware/auth.middleware.js";
import User from "../models/User.js";
import { Expo } from "expo-server-sdk";

const router = express.Router();

// 📌 ایجاد آگهی ملک جدید
router.post("/", protectRoute, async (req, res) => {
  try {
    const { title, type, price, rentPrice, mortgagePrice,  phoneNumber, location, description, images, area, city } = req.body;

    if (!title || !type || !location || !phoneNumber || !city) {
      return res.status(400).json({ message: "عنوان، نوع و موقعیت الزامی هستند" });
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

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

     const endOfDay = new Date();
     endOfDay.setHours(23, 59, 59, 999);

      const countToday = await Property.countDocuments({
       user: req.user._id,
       createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

       if (countToday >= 5) {
       return res.status(400).json({
        message: "شما امروز حداکثر ۵ آگهی ملک می‌توانید ثبت کنید"
        });
       }





    // ذخیره در دیتابیس
    const newProperty = new Property({
      title,
      type,
      price,
      rentPrice,
      mortgagePrice,
      location,
      description,
       phoneNumber,
        area,
        city,
       images: imageUrls,
      user: req.user._id,
    });

    await newProperty.save();

    // 📲 ارسال اعلان (Push Notification) مشابه Job
    const expo = new Expo();
    const users = await User.find({});
    const messages = [];
    const today = new Date().toDateString();

    for (const user of users) {
      if (!user.expoPushToken || !Expo.isExpoPushToken(user.expoPushToken)) continue;
      if (user._id.toString() === req.user._id.toString()) continue;

      const lastDate = user.lastNotificationDate?.toDateString();
      if (lastDate === today && user.notificationCount >= 5) continue;

      messages.push({
        to: user.expoPushToken,
        sound: "default",
        title: "آگهی ملک جدید",
        body: `یک آگهی جدید "${newProperty.title}" اضافه شد.`,
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

    res.status(201).json(newProperty);
  } catch (error) {
    console.error("error creating property", error);
    res.status(500).json({ message: error.message });
  }
});

// 📌 گرفتن همه آگهی‌های ملک
router.get("/", protectRoute, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const {
      title,
      type,
      price,
      rentPrice,
      mortgagePrice,
      location,
      area,
    } = req.query;



     // ساخت فیلتر داینامیک
    const filter = {};
    const ignoreValue = "بدون فیلتر";

if (title && title !== ignoreValue) {
  filter.title = { $regex: title, $options: "i" };
}

if (type && type !== ignoreValue) {
  filter.type = type;
}

if (location && location !== ignoreValue) {
  filter.location = { $regex: location, $options: "i" };
}

if (area && area !== ignoreValue) {
  filter.area = { $regex: area, $options: "i" };
}


   if (price && price !== ignoreValue) {
  filter.price = { $regex: price, $options: "i" };
}

if (rentPrice && rentPrice !== ignoreValue) {
  filter.rentPrice = { $regex: rentPrice, $options: "i" };
}

if (mortgagePrice && mortgagePrice !== ignoreValue) {
  filter.mortgagePrice = { $regex: mortgagePrice, $options: "i" };
}




    // اجرای کوئری با فیلتر
    const properties = await Property.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username profileImage");

    const total = await Property.countDocuments(filter);

    res.send({
      properties,
      currentPage: page,
      totalProperties: total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("error in get all properties route", error);
    res.status(500).json({ message: "خطای سرور" });
  }
});


// 📌 حذف آگهی ملک
router.delete("/:id", protectRoute, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "ملک پیدا نشد" });

    if (property.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "دسترسی غیر مجاز" });
    }

 if (property.images && property.images.length > 0) {
  for (const img of property.images) {
    try {
      const publicId = img.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    } catch (deleteError) {
      console.log("error deleting image from cloudinary", deleteError);
    }
  }
}

    await property.deleteOne();
    res.json({ message: "ملک با موفقیت حذف شد" });
  } catch (error) {
    console.error("error deleting property", error);
    res.status(500).json({ message: "خطای سرور" });
  }
});

// 📌 گرفتن آگهی‌های کاربر لاگین کرده
router.get("/user", protectRoute, async (req, res) => {
  try {
    const properties = await Property.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(properties);
  } catch (error) {
    console.error("get user properties error", error.message);
    res.status(500).json({ message: "خطای سرور" });
  }
});

export default router;

