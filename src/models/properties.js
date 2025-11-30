import mongoose from "mongoose";

function arrayLimit(val) {
  return val.length <= 5; 
}


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
   images: {
  type: [String],
  validate: [arrayLimit, '{PATH} بیش از 5 عکس نمی‌تواند داشته باشد']
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


