import mongoose from "mongoose";

const homeSchema = new mongoose.Schema(
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

        category: {
         type: String,
        enum: ["home", "kitchen"],
        required: true,
        },
      model: {
         type: String,
         required: false },

     status: { 
      type: String, 
      required: false 
    },

     texture: { 
      type: String, 
      required: false 
    },

    phoneNumber: {
      type: String,
      required: false,
    },
    dimensions: {
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
const HomeAndKitchen = mongoose.model("homeAndKitchen", homeSchema);

export default HomeAndKitchen;