import mongoose from "mongoose";

const notificationStatusSchema = new mongoose.Schema({
  key: {
    type: String,
    unique: true
  },
  lastSentDate: {
    type: Date,
    default: null
  }
});

const NotificationStatus = mongoose.model(
  "NotificationStatus",
  notificationStatusSchema
);

export default NotificationStatus;