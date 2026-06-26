export const notificationAuth = (req, res, next) => {
    const secret = req.headers["x-notification-secret"];

  if (!secret || secret !== process.env.NOTIFICATION_SECRET)  {
        return res.status(403).json({
            message: "Access denied"
        });
    }

    next();
};