import mongoose from "mongoose";

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
        image: {
            type: String,
            required: true,

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