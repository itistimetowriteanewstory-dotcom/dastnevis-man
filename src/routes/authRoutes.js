import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import protectRoute from "../middleware/auth.middleware.js";
import rateLimit from "express-rate-limit";
import cloudinary from "../lib/cloudinary.js";
import { OAuth2Client } from "google-auth-library";


const router = express.Router();

const generateAccessToken = (userId) =>{
   return jwt.sign({userId}, process.env.JWT_SECRET, {expiresIn: "15m"});
};
const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 🔹 اینجا تعریف کن
const loginLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // ۲۴ ساعت
  max:  5,
  message: "تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً فردا دوباره امتحان کنید.",
  standardHeaders: true,
  legacyHeaders: false,
 //  keyGenerator: (req) => {
  //  return req.headers["x-forwarded-for"]?.split(",")[0] || req.ip;
 // },
 keyGenerator: (req) => req.body.email,
});

const registerLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max:  5,
  message: "تعداد تلاش‌های ثبت‌نام بیش از حد مجاز است. لطفاً فردا دوباره امتحان کنید.",
  standardHeaders: true,
  legacyHeaders: false,
 //  keyGenerator: (req) => {
//    return req.headers["x-forwarded-for"]?.split(",")[0] || req.ip;
//  },
 keyGenerator: (req) => req.body.email,
});


router.post("/register", registerLimiter, async (req, res) => {
    try {
        const {email, username, password} = req.body;
        if(!username || !email || !password) {
            return res.status(400).json({message: "همه خانه هارا پر کنید"});
        }
        // بررسی فرمت ایمیل
       const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "ایمیل معتبر نیست" });
      }

        if(password.length < 6) {
            return res.status(400).json({message: "رمز عبور حداقل باید هفت کارکتر داشته باشد"});

        }
        if(username.length < 3){
              return res.status(400).json({message: "اسم باید حداقل چهار کارکتر داشته باشد"});
        }
      //   //check if usser exist
      //  const existingusername = await User.findOne({username});
      //  if(existingusername){
      //   return res.status(400).json({message: "نام کاربری وجود دارد با اسم دیگری ثبت نام کنید"});
      //  }

        const existingemail = await User.findOne({email});
       if(existingemail){
        return res.status(400).json({message: "ایمیل وجود دارد ایمیل متفاوتی را بنویسید"});
       }

        //get a random avatar
const profileImage = `https://api.dicebear.com/9.x/initials/svg?seed=${username}`;



       const user = new User({
        username,
        email,
        password,
        profileImage,
       });

     //  await user.save();

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        user.previousRefreshToken = null;
// رفرش توکن روتیشن
    user.refreshToken = refreshToken;
    await user.save();

       res.status(201).json({
          accessToken,
          refreshToken,
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            profileImage: user.profileImage,
            createdAt: user.createdAt,
        },
       });

    } catch (error) {
        console.log("error in register route", error);
        res.status(500).json({message: "خطای سرور لطفا بعدا دوباره امتحان کنید"});
    }
});

router.post("/login", loginLimiter, async (req, res) => {
  //  console.log("IP:", req.ip);
 // console.log("X-Forwarded-For:", req.headers["x-forwarded-for"]);
  try {
    const {email, password} = req.body;
    if(!email || !password) return res.status(400).json({message:"همه خانه هارا پر کنید"});

    //check if user exist
    const user = await User.findOne({email});
    if(!user) return res.status(400).json({message: "کاربر وجود ندارد"});

    //check if passworf is correct 
    const isPasswordCorrect = await user.comparePassword(password);
    if(!isPasswordCorrect) return res.status(400).json({message: "رمز عبور اشتباه است"});

    //genarte token 
     const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.previousRefreshToken = null;
    //رفرش توکن روتیشن
    user.refreshToken = refreshToken;
   await user.save();

    res.status(200).json({
         accessToken,
         refreshToken,
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            profileImage: user.profileImage,
            createdAt: user.createdAt,
        },
    });

  } catch (error) {
    console.log("error in login route", error);
    res.status(500).json({message: "خطای سرور لطفا بعدا امتحان کنید"});
  }
});

router.post("/save-token", protectRoute, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "توکن معتبر نیست" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "کاربر پیدا نشد" });

    user.expoPushToken = token;
    await user.save();

    res.status(200).json({ message: "توکن نوتیفیکیشن ذخیره شد" });
  } catch (error) {
    console.error("خطا در ذخیره توکن:", error.message);
    res.status(500).json({ message: "خطای سرور" });
  }
});


router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      message: "رفرش توکن ارسال نشده"
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        message: "کاربر پیدا نشد"
      });
    }

    // کاربر قدیمی که refreshToken توی دیتابیس نداره
    if (!user.refreshToken) {
      user.refreshToken = refreshToken;
      await user.save();

    } else if (
      user.refreshToken !== refreshToken &&
      user.previousRefreshToken !== refreshToken
    ) {
      return res.status(401).json({
        message: "رفرش توکن معتبر نیست"
      });
    }

    // فقط accessToken جدید میسازیم
    // refreshToken عوض نمیشه تا کاربران قدیمی مشکل نداشته باشن
    const newAccessToken = generateAccessToken(user._id);
    

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: refreshToken, // ← همون قدیمی برمیگرده
    });

  } catch (error) {
    return res.status(401).json({
      message: "رفرش توکن منقضی یا نامعتبر است"
    });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const user = await User.findOne({ refreshToken });

    if (user) {
      user.refreshToken = null;
      user.previousRefreshToken = null;
      await user.save();
    }

    return res.status(200).json({
      message: "با موفقیت خارج شدید"
    });

  } catch (error) {
    return res.status(500).json({
      message: "خطای سرور"
    });
  }
});

router.put("/update-profile", protectRoute, async (req, res) => {
  try {
    let { username, profileImage, profileImagePublicId } = req.body; // ← اضافه شد


    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "کاربر پیدا نشد" });
    }

    // -----------------------------
    // بروزرسانی Username
    // -----------------------------
    if (username !== undefined) {
      username = username.trim();

      if (!username) {
        return res.status(400).json({ message: "نام کاربری نمی‌تواند خالی باشد." });
      }

      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ message: "نام کاربری باید بین 3 تا 20 کاراکتر باشد." });
      }

      const usernameRegex = /^[\u0600-\u06FFa-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({
          message: "نام کاربری فقط می‌تواند شامل حروف فارسی، انگلیسی، اعداد و _ باشد.",
        });
      }

      // const existingUser = await User.findOne({ username });
      // if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      //   return res.status(400).json({ message: "این نام کاربری قبلاً استفاده شده است." });
      // }

      user.username = username;

      // ✅ اگه عکس پروفایل هنوز DiceBear هست، seed رو آپدیت کن
      const isDiceBear = user.profileImage?.includes("dicebear.com");
      if (isDiceBear) {
        user.profileImage = `https://api.dicebear.com/9.x/initials/svg?seed=${username}`;
      }
    }

    // -----------------------------
    // بروزرسانی عکس پروفایل (آپلود واقعی)
    // -----------------------------
    if (profileImage !== undefined) {
      if (profileImage) {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const validPrefix = `https://res.cloudinary.com/${cloudName}/image/upload/`;

        if (!profileImage.startsWith(validPrefix)) {
          return res.status(400).json({ message: "آدرس تصویر معتبر نیست." });
        }

        // 🔥 فقط اگه عکس قبلی Cloudinary بود حذفش کن (نه DiceBear)
        const isOldImageCloudinary = user.profileImage?.startsWith(validPrefix);
        if (isOldImageCloudinary) {
          try {
            if (user.profileImagePublicId) {
              const publicId = user.profileImagePublicId.includes("/")
           ? user.profileImagePublicId                       // جدید ✅
           : `profile_images/${user.profileImagePublicId}`;  // قدیمی ✅
              await cloudinary.uploader.destroy(publicId);
            } else {
              const parts = user.profileImage.split("/");
              const uploadIndex = parts.indexOf("upload");
              let startIndex = uploadIndex + 1;
              if (/^v\d+$/.test(parts[startIndex])) startIndex++;
              const fileName = parts[parts.length - 1].split(".")[0];
              const folder = parts.slice(startIndex, parts.length - 1).join("/");
              const publicId = folder ? `${folder}/${fileName}` : fileName;
              await cloudinary.uploader.destroy(publicId);
            }
          } catch (err) {
            console.log("خطا در حذف عکس قبلی:", err);
          }
        }

        user.profileImage = profileImage;
        if (profileImagePublicId) {
        user.profileImagePublicId = profileImagePublicId;  // ← کامنت رو بردار
          }
      }
    }

    await user.save();

    return res.status(200).json({
      message: "پروفایل با موفقیت بروزرسانی شد.",
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ message: "خطای سرور" });
  }
});



router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email, name, picture, sub: googleId } = ticket.getPayload();

    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      // ثبت‌نام خودکار
      user = new User({
        username: name,
        email,
        profileImage: picture,
        googleId,
      });
      isNewUser = true;
    } else if (!user.googleId) {
      user.googleId = googleId;
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.previousRefreshToken = null;
    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      accessToken,
      refreshToken,
      isNewUser,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401).json({ message: "احراز هویت گوگل ناموفق بود" });
  }
});

export default router;

