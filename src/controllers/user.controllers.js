import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import{User} from "../models/user.models.js"
import {deleteFromCloundinary, uploadonCloundinary} from "../utils/cloundinary.js"
import { json } from "express";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import nodemon from "nodemon";
const { emit } = nodemon;
import mongoose from "mongoose";


const generateAccesAndRfreshToken = async(userId)=> {
   
    try {
        const user = await User.findById(userId)
        if(!userId){
            throw new ApiError(404,"User not found")
        }
        const accesToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()


        user.refreshToken = refreshToken
        await user.save({ValidityState:false})
        return {accesToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,"Something went wrong")
    }

}


const registerUser = asyncHandler(async(req,res)=>{
   const{fullname,email,username,password}=req.body
    
   //validation
   if(
    [fullname,username,email,password].some((field)=> field?.trim()==="")
   ){
    throw new ApiError(400,"All fields are required")
    
   }
   const existedUser = await User.findOne({
    $or: [{ username }, { email }]
  });
   if(existedUser){
    throw new ApiError(409,"User with email or username alrday exits")
   }

   const avatarLocalPath = req.files?.avatar?.[0]?.path
   const coverLocalPath = req.files?.coverImage?.[0]?.path

   if(!avatarLocalPath){
    throw new ApiError(400,"Avatar file is mssing")
   }

//    const avatar = await uploadonCloundinary(avatarLocalPath)

// //    const coverImage = await uploadonCloundinary(coverLocalPath)


//    let coverImage =" "
//    if(coverLocalPath){
//     const coverImage = await uploadonCloundinary(coverImage)
//    }


let avatar;
try {
    avatar = await uploadonCloundinary(avatarLocalPath);
    console.log("Uploaded avatar:", avatar);
} catch (error) {
    console.log("Error uploading avatar:", error);
    throw new ApiError(500, "Failed to upload avatar");
}

let coverImage;
try {
    coverImage = await uploadonCloundinary(coverLocalPath);
    console.log("Uploaded coverImage:", coverImage);
} catch (error) {
    console.log("Error uploading coverImage:", error);
    throw new ApiError(500, "Failed to upload cover image");
}


   try {
    const user = await User.create({
     fullname,
     avatar:avatar.url,
     coverImage:coverImage?.url||"",
     email,
     password,
     username:username.toLowercase()
    })
     const createdUser = await User.findById(user._id).select(
         "-password -refreshToken"
     )
     if(!createdUser){
         throw new ApiError(500,"Something went wrong while registering ")
     }
 
 
 
     return res
         .status(201)
         .json(new ApiResponse(200,createdUser,"user registred successfully"))
   } catch (error) {
console.log("User cration failed");

if(avatar){
    await deleteFromCloundinary(avatar.public_id)
}
if(coverImage){
    await deleteFromCloundinary(coverImage.public_id)
}
throw new ApiError(500,"Somethinf wenr wrong while registering a user and images were deleted ")

   }
})


const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    // Validate that either email or username is provided
    if (!email && !username) {
        throw new ApiError(400, "Either email or username is required");
    }

    // Find the user by email or username
    const user = await User.findOne({
        $or: [{ email }, { username }]
    });

    // Check if the user exists
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Validate the password
    const isPasswordValid = await user.isPasswordCorrect(password);

    // If the password is invalid, throw an error
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    // Generate access and refresh tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    // Select user details excluding password and refresh token
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // Set cookie options for security
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    };

    // Send the response with cookies and user data
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json({
            message: "User logged in successfully",
            user: loggedInUser,
            accessToken,
            refreshToken,
        });
});



const logoutUser = asyncHandler(async (req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined,
            }
        },
        {new:true}
    )

    const options={
        httpOnly:true,
        secure:process.env.NODE_ENV === "production",
    }
    return res  
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .json(new ApiResponse(200,{},"User logged out successfully"))
})



const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || 
    req.body.refreshToken


    if(!incomingRefreshToken){
        throw new ApiError(401,"RefreshToken is required")
    }
    try {
        const decodedToekn = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        const user = await User.findById(decodedToekn?._id)


        if(!user){
            throw new ApiError(401,"Invalid refresh token ");
            
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Invalid refresh token")
        }


        const options ={
             hhtpOnly:true,
        secure: process.env.NODE_ENV === "production"
        }

        const {accesToken,refreshToken:newRefreshToken} = await generateAccesAndRfreshToken(user._id)
        return res
            .status(200)
            .cookie("accessToken",accesToken,options)
            .cookie("refreshToken",newRefreshToken,options)
            .json(
                new ApiResponse(
                    200,
                    {accesToken,
                        refreshAccessToken:newRefreshToken
                    },
                    "Access token refreshed successfully"
                )
            );

    } catch (error) {
        throw new ApiError(500,"Something went wrong")
    }


})



//CRUD OPERARTIONS

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    // Fetch the user from the database
    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Check if the old password is correct
    const isPasswordValid = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordValid) {
        throw new ApiError(401, "Old password is incorrect");
    }

    // Update the password
    user.password = newPassword;

    // Save the updated user
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
});



const getCurrentUser = asyncHandler(async(req,res)=>{
    return res.status(200).json(new ApiResponse(200,req.user,"Current user details"))
})


const UpdateAccountDetails = asyncHandler(async(req,res)=>{
    const{fullname,email}=req.body

    if(!fullname || !email){
        throw new ApiError(400,"Fullname and email are required")
    }
    
   const user = User.findByIdAndUpdate(
        req._user?._id,
        {
            $set:{
                fullname,
                email:email
            }
        },
        {new:true}
    ).select("-password -refreshToken")

    return res.status(200).json(new ApiResponse(200,req.user,"Account details updated successfully"))


})


const UpdateUserAvatar = asyncHandler(async (req, res) => {
    // Extract the avatar file path
    const avatarLocalPath = req.files?.avatar?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // Upload the avatar to Cloudinary
    let avatar;
    try {
        avatar = await uploadonCloundinary(avatarLocalPath);
        if (!avatar.url) {
            throw new ApiError(500, "Failed to upload avatar");
        }
    } catch (error) {
        console.error("Error uploading avatar:", error);
        throw new ApiError(500, "Something went wrong during the upload");
    }

    // Update the user's avatar in the database
    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { avatar: avatar.url } },
        { new: true }
    ).select("-password -refreshToken");

    if (!updatedUser) {
        throw new ApiError(404, "User not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "Avatar updated successfully"));
});



const UpdateUserCoverImage = asyncHandler(async (req, res) => {
    // Extract the cover image file path
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is required");
    }

    // Upload the cover image to Cloudinary
    let coverImage;
    try {
        coverImage = await uploadonCloundinary(coverImageLocalPath);
        if (!coverImage.url) {
            throw new ApiError(500, "Failed to upload cover image");
        }
    } catch (error) {
        console.error("Error uploading cover image:", error);
        throw new ApiError(500, "Something went wrong during the upload");
    }

    // Update the user's cover image in the database
    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { coverImage: coverImage.url } },
        { new: true }
    ).select("-password -refreshToken");

    if (!updatedUser) {
        throw new ApiError(404, "User not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "Cover image updated successfully"));
});


const getUserChannelProfile = asyncHandler(async(req,res)=>{
   const{username} = req.params

    if(!username){
        throw new ApiError(400,"Username is required")
    }

    const channel = await User.aggregate(
        [
            {
                $match:{
                    username:username?.toLowercase()
                }
            },
            {
                $lookup:{
                    from:"subscriptions",
                    localField:"_id",
                    foreignField:"channel",
                    as:"Sbcribers"
                }
            },{
                $lookup:{
                    from:"Subscriptions",
                    localField:"_id",
                    foreignField:"subscriber",
                    as:"subscriberedTo"
                }
            },
            {
                $addFields:{
                    subscribersCount:{
                        $size:"$subscribers"
                    },
                    channelsSubscriberdToCount:{
                        $size:"$subscriberedTo"
                    },
                 isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subbcriber.subscriber"]},
                        then:true,
                        else:false
                    }
                 }
                }
            },
            {
                //project only the necessary data
                $project:{
                    fullname:1,
                    username:1,
                    avatar:1,
                    channelsSubscriberdToCount:1,
                    isSubscribed:1,
                    coverImage:1,
                    email:1,
                }
            }
        ]
    )

    if(!channel?.length){
        throw new ApiError(404,"Channel not found")
    }
    return res.status(200).json(new ApiResponse(200,channel[0],"Current user details"))

})
const getWatchHistory = asyncHandler(async(req,res)=>{
    const user =await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup:{
                from : "videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                       $lookup:{
                        from:"users",
                        localField:"owner",
                        foreignField:"_id",
                        as:"owner",
                        pipeline:[
                            {
                               $project:{

                                fullname:1,
                                username:1,
                                email:1,
                               } 
                            }
                        ]
                       } 
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
                
            }
        }
    ])

    return res.status(200).json(new ApiResponse(200,channel[0]?.WatchHistory,"Watch history fecthed successfully"))


})


export {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    changeCurrentPassword,
    getCurrentUser,
    UpdateAccountDetails,
    UpdateUserAvatar,
    UpdateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory

}