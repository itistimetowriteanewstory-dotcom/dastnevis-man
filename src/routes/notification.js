import express from "express";
import { Expo } from "expo-server-sdk";
import User from "../models/User.js";
import { notificationAuth } from "../middleware/notificationAuth.js";

const router = express.Router();
const expo = new Expo();

router.post("/send-update", notificationAuth, async (req, res) => {
  try {
    const users = await User.find({
      expoPushToken: { $exists: true, $ne: null }
    }).select("expoPushToken");

    const messages = [];

    for (const user of users) {
      if (!Expo.isExpoPushToken(user.expoPushToken)) continue;

      messages.push({
        to: user.expoPushToken,
        sound: "default",
        title: "نسخه جدید منتشر شد 🚀",
        body: "برای استفاده از امکانات جدید برنامه را بروزرسانی کنید.",
      });
    }

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }

    res.json({
      success: true,
      count: messages.length
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message
    });
  }
});

export default router;