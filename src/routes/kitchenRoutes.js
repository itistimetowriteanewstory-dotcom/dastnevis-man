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
    const { title, caption, images, model, status, address, texture, phoneNumber, dimensions, price, location, category} = req.body;

    if (!title || !caption || !images || !location || !phoneNumber || !address) {
      return res.status(400).json({ message: "عنوان، کپشن، تصویر و موقعیت الزامی هستند" });
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
      images: imageUrls,
      model,
      status,
      texture,
      phoneNumber,
      dimensions,
      price,
      location,
      category,
      address,
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

   
   const { category, title, location, status, dimensions, model, texture } = req.query;

// ساخت فیلتر داینامیک
const filter = {};

const ignoreValue = "بدون فیلتر"; 

if (category && category !== ignoreValue) {
  filter.category = { $regex: category, $options: "i" };
}

if (title && title !== ignoreValue) {
  filter.title = { $regex: title, $options: "i" };
}

if (location && location !== ignoreValue) {
  filter.location = { $regex: location, $options: "i" };
}

if (status && status !== ignoreValue) {
  filter.status = status;
  }



// فیلتر جدید برای ابعاد
if (dimensions && dimensions !== ignoreValue) {
  filter.dimensions = { $regex: dimensions, $options: "i" };
}

// فیلتر جدید برای مدل
if (model && model !== ignoreValue) {
  filter.model = { $regex: model, $options: "i" };
}

// فیلتر جدید برای جنس
if (texture && texture !== ignoreValue) {
  filter.texture = { $regex: texture, $options: "i" };
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

     // حذف همه تصاویر از Cloudinary
    if (home.images && home.images.length > 0) {
      for (const img of home.images) {
        try {
          const publicId = img.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(publicId);
        } catch (deleteError) {
          console.log("error deleting image from cloudinary", deleteError);
        }
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

// update home/kitchen ad
router.put("/:id", protectRoute, async (req, res) => {
  try {
    const { 
      title, caption, images, model, status, address, texture, phoneNumber, dimensions, price, location, category 
    } = req.body;

    const home = await HomeAndKitchen.findById(req.params.id);
    if (!home) return res.status(404).json({ message: "آگهی پیدا نشد" });

    // فقط صاحب آگهی اجازه ویرایش دارد
    if (home.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "دسترسی غیر مجاز" });
    }

   let imageUrls = home.images || [];

if (images && Array.isArray(images)) {
  if (images.length > 5) {
    return res.status(400).json({ message: "حداکثر ۵ عکس مجاز است" });
  }

  // 🔹 پیدا کردن عکس‌هایی که کاربر حذف کرده
  const newImageSet = new Set(images);
  const removedImages = imageUrls.filter(img => !newImageSet.has(img));

  // 🔹 فقط عکس‌های حذف‌شده رو پاک کن
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
      imageUrls.push(uploadResponse.secure_url);
    } else if (typeof img === "string" && img.startsWith("http")) {
      imageUrls.push(img); // لینک قبلی نگه داشته میشه
    }
  }
}


    // بروزرسانی فیلدها
    home.title = title || home.title;
    home.caption = caption || home.caption;
    home.images = imageUrls;
    home.model = model || home.model;
    home.status = status || home.status;
    home.address = address || home.address;
    home.texture = texture || home.texture;
    home.phoneNumber = phoneNumber || home.phoneNumber;
    home.dimensions = dimensions || home.dimensions;
    home.price = price || home.price;
    home.location = location || home.location;
    home.category = category || home.category;

    await home.save();

    res.json({ message: "آگهی خانه/آشپزخانه با موفقیت بروزرسانی شد", home });
  } catch (error) {
    console.error("error updating home/kitchen ad", error);
    res.status(500).json({ message: "خطای سرور لطفا بعدا امتحان کنید" });
  }
});

// get home/kitchen ad by id
router.get("/:id", protectRoute, async (req, res) => {
  try {
    const home = await HomeAndKitchen.findById(req.params.id).populate("user", "username profileImage");
    if (!home) return res.status(404).json({ message: "آگهی پیدا نشد" });

    res.json(home);
  } catch (error) {
    console.error("error fetching home/kitchen ad", error);
    res.status(500).json({ message: "خطای سرور لطفا بعدا امتحان کنید" });
  }
});



export default router;

