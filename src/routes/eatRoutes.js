import express from "express";
import cloudinary from "../lib/cloudinary.js";
import Eat from "../models/Eat.js";   // مدل جدید غذا/خوراکی
import protectRoute from "../middleware/auth.middleware.js";

const router = express.Router();

// 📌 ایجاد آگهی غذا جدید
router.post("/", protectRoute, async (req, res) => {
  try {
    const { title, caption, images, phoneNumber, price, location, address } = req.body;

    if (!title || !caption || !images || !location || !address) {
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

    const countToday = await Eat.countDocuments({
      user: req.user._id,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    if (countToday >= 5) {
      return res.status(400).json({
        message: "شما امروز حداکثر ۵ آگهی غذا می‌توانید ثبت کنید"
      });
    }

    // ذخیره در دیتابیس
    const newEat = new Eat({
      title,
      caption,
      images: imageUrls,
      phoneNumber,
      price,
      location,
      address,
      user: req.user._id,
    });

    await newEat.save();
    res.status(201).json(newEat);
  } catch (error) {
    console.error("error creating eat", error);
    res.status(500).json({ message: error.message });
  }
});

// 📌 گرفتن همه آگهی‌های غذا
router.get("/", protectRoute, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // گرفتن پارامترهای جستجو از کوئری
    const { title, location } = req.query;

    // ساخت فیلتر داینامیک
    const filter = {};
    const ignoreValue = "بدون فیلتر"; 
    
    if (title && title ==! ignoreValue) {
      filter.title = { $regex: title, $options: "i" };
    }

    if (location && location ==! ignoreValue) {
      filter.location = { $regex: location, $options: "i" };
    }

    // اجرای کوئری با فیلتر
    const eats = await Eat.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username profileImage");

    const total = await Eat.countDocuments(filter);

    res.send({
      eats,
      currentPage: page,
      totalEats: total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("error in get all eats route", error);
    res.status(500).json({ message: "خطای سرور" });
  }
});


// 📌 حذف آگهی غذا
router.delete("/:id", protectRoute, async (req, res) => {
  try {
    const eat = await Eat.findById(req.params.id);
    if (!eat) return res.status(404).json({ message: "آگهی پیدا نشد" });

    if (eat.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "دسترسی غیر مجاز" });
    }

    // حذف همه تصاویر از Cloudinary (نسخه اول)
      if (eat.images && eat.images.length > 0) {
        for (const img of eat.images) {
          try {
            const publicId = img.split("/").pop().split(".")[0];
            await cloudinary.uploader.destroy(publicId);
          } catch (deleteError) {
            console.log("error deleting image from cloudinary", deleteError);
          }
        }
      }

    await eat.deleteOne();
    res.json({ message: "آگهی با موفقیت حذف شد" });
  } catch (error) {
    console.error("error deleting eat", error);
    res.status(500).json({ message: "خطای سرور" });
  }
});

// 📌 گرفتن آگهی‌های کاربر لاگین کرده
router.get("/user", protectRoute, async (req, res) => {
  try {
    const eats = await Eat.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(eats);
  } catch (error) {
    console.error("get user eats error", error.message);
    res.status(500).json({ message: "خطای سرور" });
  }
});

// update eat
router.put("/:id", protectRoute, async (req, res) => {
  try {
    const { title, caption, images, phoneNumber, price, location, address } = req.body;

    const eat = await Eat.findById(req.params.id);
    if (!eat) return res.status(404).json({ message: "آگهی پیدا نشد" });

    // فقط صاحب آگهی اجازه ویرایش دارد
    if (eat.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "دسترسی غیر مجاز" });
    }

    let imageUrls = eat.images;

    // اگر تصاویر جدید فرستاده شده باشند
    if (images && Array.isArray(images)) {
      if (images.length > 5) {
        return res.status(400).json({ message: "حداکثر ۵ عکس مجاز است" });
      }

      // 🔹 اول تصاویر قبلی رو از Cloudinary پاک کن
      if (eat.images && eat.images.length > 0) {
        for (const img of eat.images) {
          try {
            const publicId = img.split("/").pop().split(".")[0]; 
            await cloudinary.uploader.destroy(publicId);
          } catch (deleteError) {
            console.log("error deleting old image from cloudinary", deleteError);
          }
        }
      }

      // 🔹 بعد تصاویر جدید رو آپلود کن
      imageUrls = [];
      for (const img of images) {
        if (typeof img === "string" && img.startsWith("data:image/")) {
          const uploadResponse = await cloudinary.uploader.upload(img);
          imageUrls.push(uploadResponse.secure_url);
        } else if (typeof img === "string" && img.startsWith("http")) {
          imageUrls.push(img); // اگر لینک قبلی باشه، نگهش داریم
        }
      }
    }

    // بروزرسانی فیلدها
    eat.title = title || eat.title;
    eat.caption = caption || eat.caption;
    eat.images = imageUrls;
    eat.phoneNumber = phoneNumber || eat.phoneNumber;
    eat.price = price || eat.price;
    eat.location = location || eat.location;
    eat.address = address || eat.address;

    await eat.save();

    res.json({ message: "آگهی غذا با موفقیت بروزرسانی شد", eat });
  } catch (error) {
    console.error("error updating eat", error);
    res.status(500).json({ message: "خطای سرور لطفا بعدا امتحان کنید" });
  }
});

// get eat by id
router.get("/:id", protectRoute, async (req, res) => {
  try {
    const eat = await Eat.findById(req.params.id).populate("user", "username profileImage");
    if (!eat) return res.status(404).json({ message: "آگهی پیدا نشد" });

    res.json(eat);
  } catch (error) {
    console.error("error fetching eat", error);
    res.status(500).json({ message: "خطای سرور لطفا بعدا امتحان کنید" });
  }
});



export default router;

