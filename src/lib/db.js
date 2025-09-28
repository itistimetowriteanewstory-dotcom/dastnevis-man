import mongoose from "mongoose";

export const connectDB = async () => {

    try {
     const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`database coonected ${conn.connection.host}`);
    } catch (error) {
        console.log("error connecting to database", error);
        process.exit(1); //exit with  failuer
    }
};