import jwt from "jsonwebtoken";
import User from "../models/User.js";

const protectRoute = async(req, res, next)=>{

    try {

     // ✅ اول بررسی کن که هدر Authorization وجود داره
    const authHeader = req.header("Authorization");
      if (!authHeader) {
      return res.status(401).json({ message: "توکن ارسال نشده" });
      }
        const accessToken = req.header("Authorization").replace("Bearer", "").trim();
        if (!accessToken) return res.status(401).json({message: "توکن احراز هویت یافت نشد"});

        // verfiy token 
           // ✅ اینجا بلاک try/catch برای jwt.verify قرار می‌گیره
       let decoded;
       try {
        decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
         console.log("Decoded:", decoded);
          console.log("⏰ Exp (UTC):", new Date(decoded.exp * 1000));
       } catch (err) {
         console.error("JWT Error:", err);
        if (err.name === "TokenExpiredError") {
            console.error("⏳ Token expired at:", err.expiredAt);
          return res.status(401).json({ message: "توکن منقضی شده" });
         }
        return res.status(401).json({ message: "توکن نامعتبر است" });
        }
        // find the user
        const user = await User.findById(decoded.userId).select("-password");
        if(!user) return res.status(401).json({message: "توکن معتبر نیست از حساب کاربری خود خارج شوید و دوباره وارد شوید"});

        req.user = user;
        next();
    } catch (error) {
        console.error("authentication error", error.message);
        res.status(401).json({message: "توکن معتبر نیست از حساب کاربری خود خارج شوید و دوباره وارد شوید "});
    }

}

export default protectRoute;