import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
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
       
      workingHours: {
         type: String,
         required: false },

     paymentType: { 
      type: String, 
      required: false 
    },


    phoneNumber: {
      type: String,
      required: false,
    },
    jobtitle: {
      type: String, 
      required: false,
    },
    income: { 
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
const Job = mongoose.model("job", jobSchema);

export default Job;