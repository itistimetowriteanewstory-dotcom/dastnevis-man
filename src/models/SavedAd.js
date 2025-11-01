import mongoose from "mongoose";

const savedAdSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  ad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ad", // یا مدل ملک/کار
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const SavedAd = mongoose.model("SavedAd", savedAdSchema);

export default SavedAd;