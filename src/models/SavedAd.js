import mongoose from "mongoose";

const savedAdSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  ad: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "adType"   // 👈 اینجا می‌گه ref وابسته به adType هست
  },
  adType: {
    type: String,
    required: true,
    enum: ["job", "property","car", "cloutes", "eat",  "homeAndKitchen"]  // 👈 اسم دقیق مدل‌هایی که ساختی
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const SavedAd = mongoose.model("SavedAd", savedAdSchema);

export default SavedAd;
