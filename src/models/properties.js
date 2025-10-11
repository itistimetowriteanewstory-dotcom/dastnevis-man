import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["rent", "mortgage", "sale"], // اجاره، رهن، فروش
      required: true,
    },
    price: {
      type: Number,
      required: false,
    },

      rentPrice: { 
        type: Number,
        required: false 
    },
    mortgagePrice: { 
        type: Number, 
        required: false 
    },
    location: {
      type: String, // ساده مثل مدل Job (بعداً می‌تونی آبجکت یا مختصات بذاری)
      required: true,
    },
    description: {
      type: String,
    },
    images: [
      {
        type: String, // لینک عکس‌ها
      },
    ],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Property = mongoose.model("Property", propertySchema);

export default Property;


