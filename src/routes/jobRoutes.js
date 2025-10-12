import express from "express";
import cloudinary from "../lib/cloudinary.js"
import Job from "../models/Jobs.js";
import protectRoute from "../middleware/auth.middleware.js";
import User from "../models/User.js";
import { Expo } from "expo-server-sdk";



const router = express.Router();

router.post("/", protectRoute, async (req, res) => {
    try {
        const {title, caption, image, phoneNumber, jobtitle, income, location} = req.body;
   if(!image || !title || !caption || !phoneNumber || !income || !location) {
    return res.status(400).json({message: "همه خانه هارا پر کنید"});
    }

    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
  console.log("فرمت تصویر نامعتبر یا ناقص:", image?.slice(0, 100));
  return res.status(400).json({ message: "فرمت تصویر نامعتبر است یا تصویر ارسال نشده" });
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



    //upload thr image to cloudinary
   const uploadResponce = await cloudinary.uploader.upload(image);
   const imageUrl = uploadResponce.secure_url

   //save to the data base
  const newJob = new Job({
    title,
    caption,
    image: imageUrl,
    phoneNumber,
    jobtitle,
    income,
    location,
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

if (messages.length > 0) {
  try {
    const ticketChunk = await expo.sendPushNotificationsAsync(messages);
    console.log("Expo tickets:", ticketChunk);
  } catch (error) {
    console.error("Error sending notifications:", error);
  }
}


  res.status(201).json(newJob)

    } catch (error) {
        console.log("error creating job ", error);
        res.status(500).json({message: error.message});
    }
});

// get all jobs
router.get("/", protectRoute, async (req, res)=>{
    try {

     const page = req.query.page || 1;
     const limit = req.query.limit || 3;
     const skip = (page - 1) * limit;

        const jobs = await Job.find().sort({ createdAt: -1})
        .skip(skip)
        .limit(limit)
        .populate("user", "username profileImage");

        const total = await Job.countDocuments();
        res.send({
            jobs,
            currentPage: page,
            totalJobs: total,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.log("error in get all jobs route");
        res.status(500).json({message: "خطای سرور"});
    }
});

router.delete("/:id", protectRoute, async (req, res) =>{
    try {
        const job = await Job.findById(req.params.id);
        if(!job) return res.status(404).json({message: "شغل پیدا نشد"});

        // check if user is the creater of the job
        if(job.user.toString() !== req.user._id.toString())
            return res.status(401).json({message: "دسترسی غیر مجاز"});

        // delete image from cloudinary
        if(job.image && job.image.includes("cloudinary")){
            try {
                const publicId = job.image.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(publicId);
            } catch (deleteError) {
                console.log("error deleting image from cloudinary", deleteError);
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