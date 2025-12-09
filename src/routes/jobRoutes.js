import express from "express";
import cloudinary from "../lib/cloudinary.js"
import Job from "../models/Jobs.js";
import protectRoute from "../middleware/auth.middleware.js";
import User from "../models/User.js";
import { Expo } from "expo-server-sdk";



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

  const expo = new Expo();

// بعد از ذخیره 
const users = await User.find({}); // یا فیلتر خاصی برای کاربران فعال

const messages = [];
const today = new Date().toDateString();

for (const user of users) {
  if (!user.expoPushToken || !Expo.isExpoPushToken(user.expoPushToken)) continue;

  const lastDate = user.lastNotificationDate?.toDateString();

  if (user._id.toString() === req.user._id.toString()) continue;

  // اگر امروز نوتیف داده شده و تعدادش به ۵ رسیده، دیگه نفرست
  if (lastDate === today && user.notificationCount >= 5) continue;

  messages.push({
    to: user.expoPushToken,
    sound: 'default',
    title: 'شغل جدیدی اضافه شد',
    body: `شغل جدیدی "${newJob.title}" به لیست اضافه شد.`,
  });

  // اگر امروز نوتیف داده شده، شمارنده رو زیاد کن، وگرنه از ۱ شروع کن
  user.notificationCount = (lastDate === today) ? user.notificationCount + 1 : 1;
  user.lastNotificationDate = new Date();
  await user.save();
}







  res.status(201).json(newJob)

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

  
if (title && title !== "همه" && title !== "بدون فیلتر") {
  query.title = { $regex: title, $options: "i" };
}

if (location && location !== "همه" && location !== "بدون فیلتر") {
  query.location = location;
}


if (workingHours && workingHours !== "همه" && workingHours !== "بدون فیلتر") {
  query.workingHours = workingHours;
}


if (paymentType && paymentType !== "همه" && paymentType !== "بدون فیلتر") {
  query.paymentType = paymentType;
}


if (income && income !== "همه" && income !== "بدون فیلتر") {
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

export default router;