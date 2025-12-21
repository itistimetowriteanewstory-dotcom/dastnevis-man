import express from "express";
import cloudinary from "../lib/cloudinary.js";
import Cloutes from "../models/Cloutes.js";   // مدل جدید پوشاک/کالای مد
import protectRoute from "../middleware/auth.middleware.js";
import User from "../models/User.js";
import { Expo } from "expo-server-sdk";

const router = express.Router();

// 📌 ایجاد آگهی جدید (Cloutes)
router.post("/", protectRoute, async (req, res) => {
  try {
    const { title, caption, images, cloutesModel, address, cloutesStatus, cloutesTexture, phoneNumber, price, location } = req.body;

    if (!title || !caption || !images || !location || !phoneNumber  || !address) {
      return res.status(400).json({ message: "عنوان، کپشن، تصویر و موقعیت و آدرس الزامی هستند" });
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

    const countToday = await Cloutes.countDocuments({
      user: req.user._id,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    if (countToday >= 5) {
      return res.status(400).json({
        message: "شما امروز حداکثر ۵ آگهی پوشاک/کالا می‌توانید ثبت کنید"
      });
    }

    // ذخیره در دیتابیس
    const newCloute = new Cloutes({
      title,
      caption,
      images: imageUrls,
      cloutesModel,
      cloutesStatus,
      cloutesTexture,
      phoneNumber,
      price,
      location,
      address,
      user: req.user._id,
    });

    await newCloute.save();

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
        title: "آگهی پوشاک جدید",
        body: `یک آگهی جدید "${newCloute.title}" اضافه شد.`,
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

    res.status(201).json(newCloute);
  } catch (error) {
    console.error("error creating cloute", error);
    res.status(500).json({ message: error.message });
  }
});

// 📌 گرفتن همه آگهی‌های Cloutes
router.get("/", protectRoute, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // گرفتن پارامترهای جستجو از کوئری
    const { title, cloutesModel, location, cloutesStatus, cloutesTexture } = req.query;

    // ساخت فیلتر داینامیک
    const filter = {};
    const ignoreValue = "بدون فیلتر"; 

if (title && title !== ignoreValue) {
  filter.title = { $regex: title, $options: "i" };
}

if (cloutesModel && cloutesModel !== ignoreValue) {
  filter.cloutesModel = { $regex: cloutesModel, $options: "i" };
}

if (location && location !== ignoreValue) {
  filter.location = { $regex: location, $options: "i" };
}

if (cloutesTexture && cloutesTexture !== ignoreValue) {
  filter.cloutesTexture = { $regex: cloutesTexture, $options: "i" };
}

if (cloutesStatus && cloutesStatus !== ignoreValue) {
  filter.cloutesStatus = { $regex: cloutesStatus, $options: "i" };
}

    // اجرای کوئری با فیلتر
    const cloutes = await Cloutes.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username profileImage");

    const total = await Cloutes.countDocuments(filter);

    res.send({
      cloutes,
      currentPage: page,
      totalCloutes: total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("error in get all cloutes route", error);
    res.status(500).json({ message: "خطای سرور" });
  }
});



// 📌 حذف آگهی Cloutes
router.delete("/:id", protectRoute, async (req, res) => {
  try {
    const cloute = await Cloutes.findById(req.params.id);
    if (!cloute) return res.status(404).json({ message: "آگهی پیدا نشد" });

    if (cloute.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "دسترسی غیر مجاز" });
    }

   // حذف همه تصاویر از Cloudinary (نسخه اول)
   if (cloute.images && cloute.images.length > 0) {
     for (const img of cloute.images) {
       try {
         const publicId = img.split("/").pop().split(".")[0];
         await cloudinary.uploader.destroy(publicId);
       } catch (deleteError) {
         console.log("error deleting image from cloudinary", deleteError);
       }
     }
   }

    await cloute.deleteOne();
    res.json({ message: "آگهی با موفقیت حذف شد" });
  } catch (error) {
    console.error("error deleting cloute", error);
    res.status(500).json({ message: "خطای سرور" });
  }
});

// 📌 گرفتن آگهی‌های کاربر لاگین کرده
router.get("/user", protectRoute, async (req, res) => {
  try {
    const cloutes = await Cloutes.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(cloutes);
  } catch (error) {
    console.error("get user cloutes error", error.message);
    res.status(500).json({ message: "خطای سرور" });
  }
});

// update cloute
router.put("/:id", protectRoute, async (req, res) => {
  try {
    const { 
      title, caption, images, cloutesModel, address, cloutesStatus, cloutesTexture, phoneNumber, price, location 
    } = req.body;

    const cloute = await Cloutes.findById(req.params.id);
    if (!cloute) return res.status(404).json({ message: "آگهی پیدا نشد" });

    // فقط صاحب آگهی اجازه ویرایش دارد
    if (cloute.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "دسترسی غیر مجاز" });
    }

    let imageUrls = cloute.images || [];

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
    cloute.title = title || cloute.title;
    cloute.caption = caption || cloute.caption;
    cloute.images = imageUrls;
    cloute.cloutesModel = cloutesModel || cloute.cloutesModel;
    cloute.address = address || cloute.address;
    cloute.cloutesStatus = cloutesStatus || cloute.cloutesStatus;
    cloute.cloutesTexture = cloutesTexture || cloute.cloutesTexture;
    cloute.phoneNumber = phoneNumber || cloute.phoneNumber;
    cloute.price = price || cloute.price;
    cloute.location = location || cloute.location;

    await cloute.save();

    res.json({ message: "آگهی پوشاک با موفقیت بروزرسانی شد", cloute });
  } catch (error) {
    console.error("error updating cloute", error);
    res.status(500).json({ message: "خطای سرور لطفا بعدا امتحان کنید" });
  }
});

// get cloute by id
router.get("/:id", protectRoute, async (req, res) => {
  try {
    const cloute = await Cloutes.findById(req.params.id).populate("user", "username profileImage");
    if (!cloute) return res.status(404).json({ message: "آگهی پیدا نشد" });

    res.json(cloute);
  } catch (error) {
    console.error("error fetching cloute", error);
    res.status(500).json({ message: "خطای سرور لطفا بعدا امتحان کنید" });
  }
});


export default router;

