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
        rating: {
            type: Number,
            required: false,
            min: 1,
            max: 5,
        },

    phoneNumber: {
      type: String,
      required: false,
    },
    jobtitle: {
      type: String, // حذف enum
      required: false,
    },
    income: { // فیلد جدید با نوع Number
      type: String,
      required: false,
    },
     location: {
      type: String, // حذف enum
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