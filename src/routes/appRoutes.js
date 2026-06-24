import express from "express";

const router = express.Router();

// GET /api/app/version
// بدون نیاز به auth — چون کاربر قبل از هر چیز باید بتونه چک کنه
router.get("/version", (req, res) => {
  res.json({
    latestVersion: process.env.APP_LATEST_VERSION || "1.1.0",
    forceUpdate: process.env.APP_FORCE_UPDATE === "true",
    storeUrl:
      process.env.APP_STORE_URL ||
      "https://play.google.com/store/apps/details?id=com.dastnevis.mobile",
  });
});

export default router;