import mongoose from "mongoose";

const eatSchema = new mongoose.Schema(
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

    phoneNumber: {
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
const Eat = mongoose.model("eat", eatSchema);

export default Eat;