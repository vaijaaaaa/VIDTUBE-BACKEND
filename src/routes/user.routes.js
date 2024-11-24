import { Router } from "express";
import { 
    registerUser, 
    logoutUser, 
    loginUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, // Corrected typo here
    getUserChannelProfile, 
    UpdateAccountDetails, 
    UpdateUserAvatar, 
    UpdateUserCoverImage, 
    getWatchHistory 
} from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

// Unsecured routes
router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1,
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
);

router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);

// Secured routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser); // Corrected typo here
router.route("/c/:username").get(verifyJWT, getUserChannelProfile);
router.route("/update-account").patch(verifyJWT, UpdateAccountDetails);
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), UpdateUserAvatar);
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), UpdateUserCoverImage);
router.route("/history").get(verifyJWT, getWatchHistory);

export default router;
