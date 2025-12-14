import mongoose from "mongoose";

function arrayLimit(val) {
  return val.length <= 5; 
}

const colutesSchema = new mongoose.Schema(
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

      cloutesModel: {
         type: String,
         required: false },

     cloutesStatus: { 
      type: String, 
      required: false 
    },

     cloutesTexture: { 
      type: String, 
      required: false 
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
const Cloutes = mongoose.model("cloutes", colutesSchema);

export default Cloutes;