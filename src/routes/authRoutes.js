import express, { json } from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
const router = express.Router();

const generateToken = (userId) =>{
   return jwt.sign({userId}, process.env.JWT_SECRET, {expiresIn: "15d"});
}

router.post("/register", async (req, res) => {
    try {
        const {email, username, password} = req.body;
        if(!username || !email || !password) {
            return res.status(400).json({massage: "all filed are required"});
        }

        if(password.length < 6) {
            return res.status(400).json({message: "password should be at least 6 charecters long"});

        }
        if(username.length < 3){
              return res.status(400).json({message: "username should be at least 4 charecters long"});
        }
        //check if usser exist
       const existingusername = await User.findOne({username});
       if(existingusername){
        return res.status(400).json({message: "username alerady exist"});
       }

        const existingemail = await User.findOne({email});
       if(existingemail){
        return res.status(400).json({message: "email alerady exist"});
       }

        //get a random avatar
const profileImage= `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

       const user = new User({
        username,
        email,
        password,
        profileImage,
       })

       await user.save();

       const token = generateToken(user._id);
       res.status(201).json({
        token,
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            profileImage: user.profileImage
        },
       });

    } catch (error) {
        console.log("error in register route", error);
        res.status(500).json({message: "internal server error"});
    }
});

router.post("/login", async (req, res) => {
  try {
    const {email, password} = req.body;
    if(!email || !password) return res.status(400).json({message:"all field required"});

    //check if user exist
    const user = await User.findOne({email});
    if(!user) return res.status(400).json({message: "user not exisit "});

    //check if passworf is correct 
    const isPasswordCorrect = await user.comparePassword(password);
    if(!isPasswordCorrect) return res.status(400).json({message: "inviled password"});

    //genarte token 
    const token = generateToken(user._id);
    res.status(200).json({
        token,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            profileImage: user.profileImage,
        },
    });

  } catch (error) {
    console.log("error in login route", error);
    res.status(500).json({message: "inernal server error"});
  }
});




export default router;