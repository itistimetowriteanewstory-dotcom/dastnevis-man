import mongoose from "mongoose";

function arrayLimit(val) {
  return val.length <= 5; 
}

const carSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        caption: {
            type: String,
            required: true,
        },
        images: {
        type: [String],
        validate: [arrayLimit]
        },
       
      model: {
         type: String,
         required: false },

     brand: { 
      type: String, 
      required: false 
    },

     fuelType: { 
      type: String, 
      required: false 
    },

    phoneNumber: {
      type: String,
      required: false,
    },
      adType: {
      type: String,
      required: true,
    },


    carcard: {
      type: String, 
      required: false,
    },
    price: { 
      type: String,
      required: false,
    },
     location: {
      type: String, 
      required: false,
     },
        user:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    }, {timestamps: true}
);
const Car = mongoose.model("car", carSchema);

export default Car;