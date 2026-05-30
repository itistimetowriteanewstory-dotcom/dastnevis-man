import express from "express";
import cloudinary from "../lib/cloudinary.js"
import Job from "../models/Jobs.js";
import protectRoute from "../middleware/auth.middleware.js";
import User from "../models/User.js";
import { Expo } from "expo-server-sdk";

const expo = new Expo();

const router = express.Router();

router.post("/", protectRoute, async (req, res) => {
    try {
        const {title, caption, images, phoneNumber, jobtitle, income, location, workingHours, paymentType} = req.body;
   if(!images || !title || !caption || !phoneNumber || !income || !location|| !workingHours || !paymentType) {
    return res.status(400).json({message: "همه خانه هارا پر کنید"});
    }

   // محدودیت تعداد عکس
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


 // 🔹 محدودیت روزانه ۳ کار
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayJobsCount = await Job.countDocuments({
      user: req.user._id,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    if (todayJobsCount >= 3) {
      return res.status(403).json({ message: "شما فقط می‌توانید روزی ۳ شغل اضافه کنید" });
    }





   //save to the data base
  const newJob = new Job({
    title,
    caption,
    images: imageUrls,
    phoneNumber,
    jobtitle,
    income,
    location,
     workingHours,
     paymentType,
    user: req.user._id,
  })

  await newJob.save();

 

// پاسخ سریع به فرانت
res.status(201).json(newJob);

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

      // به سازنده شغل نده
      if (user._id.toString() === req.user._id.toString()) {
        continue;
      }

      // اعتبار توکن
      if (
        !user.expoPushToken ||
        !Expo.isExpoPushToken(user.expoPushToken)
      ) {
        continue;
      }

      const lastDate =
        user.lastNotificationDate?.toDateString();

      // فقط یک اعلان در روز
      if (lastDate === today) {
        continue;
      }

      messages.push({
        to: user.expoPushToken,
        sound: "default",
        title: "فرصت‌های شغلی جدید",
        body: "امروز فرصت‌های شغلی جدیدی به سامانه اضافه شده‌اند.",
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

    // بروزرسانی کاربران به صورت گروهی
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
        console.log("error creating job ", error);
        res.status(500).json({message: error.message});
    }
});

// get all jobs
router.get("/", protectRoute, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

  const {
    title = "",
    location = "",
    workingHours = "",
    paymentType = "",
    income = ""
  } = req.query;

  const query = {};
  const ignoreValue = "بدون فیلتر";
  
if (title && title !== ignoreValue) {
  query.title = { $regex: title, $options: "i" };
}

if (location && location !== ignoreValue) {
  query.location = location;
}


if (workingHours && workingHours !== ignoreValue) {
  query.workingHours = workingHours;
}


if (paymentType && paymentType !== ignoreValue) {
  query.paymentType = paymentType;
}


if (income && income !== ignoreValue) {
  query.income = { $regex: income, $options: "i" };
}


    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username profileImage");

    const total = await Job.countDocuments(query);

    res.send({
      jobs,
      currentPage: page,
      totalJobs: total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.log("error in get all jobs route", error);
    res.status(500).json({ message: "خطای سرور" });
  }
});

router.delete("/:id", protectRoute, async (req, res) =>{
    try {
        const job = await Job.findById(req.params.id);
        if(!job) return res.status(404).json({message: "شغل پیدا نشد"});

        // check if user is the creater of the job
        if(job.user.toString() !== req.user._id.toString())
            return res.status(401).json({message: "دسترسی غیر مجاز"});

       // حذف همه تصاویر از Cloudinary
    if (job.images && job.images.length > 0) {
      for (const img of job.images) {
        try {
          const publicId = img.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(publicId);
        } catch (deleteError) {
          console.log("error deleting image from cloudinary", deleteError);
        }
      }
    }


        await job.deleteOne();
       res.json({message: "شغل با موفقیت حذف شد"});

    } catch (error) {
        console.log("errpr deleting job ");
        res.status(500).json({message: "خطای سرور لطفا بعدا امتحان کنید"});
    }
});

// get jobs by the loggged in user
router.get("/user", protectRoute, async (req, res) =>{
    try {
        const jobs = await Job.find({user: req.user._id}).sort({createdAt: -1});
        res.json(jobs);
    } catch (error) {
        console.error("get user jobs erroe", error.message);
        res.status(500).json({message: "خطای سرور"});
    }
});

// update job
router.put("/:id", protectRoute, async (req, res) => {
  try {
    const { 
      title, caption, images, phoneNumber, jobtitle, 
      income, location, workingHours, paymentType 
    } = req.body;

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "شغل پیدا نشد" });

    // فقط صاحب آگهی اجازه ویرایش دارد
    if (job.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "دسترسی غیر مجاز" });
    }

    let imageUrls = job.images || [];

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
    job.title = title || job.title;
    job.caption = caption || job.caption;
    job.images = imageUrls;
    job.phoneNumber = phoneNumber || job.phoneNumber;
    job.jobtitle = jobtitle || job.jobtitle;
    job.income = income || job.income;
    job.location = location || job.location;
    job.workingHours = workingHours || job.workingHours;
    job.paymentType = paymentType || job.paymentType;

    await job.save();

    res.json({ message: "آگهی با موفقیت بروزرسانی شد", job });
  } catch (error) {
    console.error("error updating job", error);
    res.status(500).json({ message: "خطای سرور لطفا بعدا امتحان کنید" });
  }
});

// get job by id
router.get("/:id", protectRoute, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate("user", "username profileImage");
    if (!job) return res.status(404).json({ message: "شغل پیدا نشد" });

    res.json(job);
  } catch (error) {
    console.error("error fetching job", error);
    res.status(500).json({ message: "خطای سرور لطفا بعدا امتحان کنید" });
  }
});


export default router;