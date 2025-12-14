import mongoose from "mongoose";

function arrayLimit(val) {
  return val.length <= 5; 
}

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
       images: {
       type: [String],
       validate: [arrayLimit]
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
      address: {
     type: String,
     required: true,
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