import express from "express";
import cloudinary from "../lib/cloudinary.js"
import Book from "../models/Book.js";
import protectRoute from "../middleware/auth.middleware.js";


const router = express.Router();

router.post("/", protectRoute, async (req, res) => {
    try {
        const {title, caption, rating, image, phoneNumber, jobtitle, income, location} = req.body;
   if(!image || !title || !caption || !phoneNumber || !income || !location) {
    return res.status(400).json({message: "همه خانه هارا پر کنید"});
    }

    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
  console.log("فرمت تصویر نامعتبر یا ناقص:", image?.slice(0, 100));
  return res.status(400).json({ message: "فرمت تصویر نامعتبر است یا تصویر ارسال نشده" });
}


    //upload thr image to cloudinary
   const uploadResponce = await cloudinary.uploader.upload(image);
   const imageUrl = uploadResponce.secure_url

   //save to the data base
  const newBook = new Book({
    title,
    caption,
    rating,
    image: imageUrl,
    phoneNumber,
    jobtitle,
    income,
    location,
    user: req.user._id,
  })

  await newBook.save();

  res.status(201).json(newBook)

    } catch (error) {
        console.log("error creating book ", error);
        res.status(500).json({message: error.message});
    }
});

// get all books
router.get("/", protectRoute, async (req, res)=>{
    try {

     const page = req.query.page || 1;
     const limit = req.query.limit || 5;
     const skip = (page - 1) * limit;

        const books = await Book.find().sort({ createdAt: -1})
        .skip(skip)
        .limit(limit)
        .populate("user", "username profileImage");

        const total = await Book.countDocuments();
        res.send({
            books,
            currentPage: page,
            totalBooks: total,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.log("error in get all books route");
        res.status(500).json({message: "خطای سرور"});
    }
});

router.delete("/:id", protectRoute, async (req, res) =>{
    try {
        const book = await Book.findById(req.params.id);
        if(!book) return res.status(404).json({message: "شغل پیدا نشد"});

        // check if user is the creater of the book 
        if(book.user.toString() !== req.user._id.toString())
            return res.status(401).json({message: "دسترسی غیر مجاز"});

        // delete image from cloudinary
        if(book.image && book.image.includes("cloudinary")){
            try {
                const publicId = book.image.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(publicId);
            } catch (deleteError) {
                console.log("error deleting image from cloudinary", deleteError);
            }
        }

        await book.deleteOne();
       res.json({message: "شغل با موفقیت حذف شد"});

    } catch (error) {
        console.log("errpr deleting book ");
        res.status(500).json({message: "خطای سرور لطفا بعدا امتحان کنید"});
    }
});

// get recommended books by the loggged in user
router.get("/user", protectRoute, async (req, res) =>{
    try {
        const books = await Book.find({user: req.user._id}).sort({createdAt: -1});
        res.json(books);
    } catch (error) {
        console.error("get user books erroe", error.message);
        res.status(500).json({message: "خطای سرور"});
    }
});

export default router;