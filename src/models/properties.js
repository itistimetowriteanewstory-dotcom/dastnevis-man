import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,

      required: true,
    },
    price: {
      type: String,
      required: false,
    },

      rentPrice: { 
        type: String,
        required: false 
    },
    mortgagePrice: { 
        type: String, 
        required: false 
    },
    location: {
      type: String, // ساده مثل مدل Job (بعداً می‌تونی آبجکت یا مختصات بذاری)
      required: true,
    },
    area: {
  type: String,
  required: false, // یا true اگر اجباری باشه
},
    description: {
      type: String,
    },
    image: {
        type: String, // لینک عکس‌ها
      },

     phoneNumber: {   // 🔹 شماره تماس اضافه شد
      type: String,
      required: true,
},
city: {
  type: String,
  required: true,
},
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Property = mongoose.model("property", propertySchema);

export default Property;


