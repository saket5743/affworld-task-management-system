

const Users = require("../models/user.model"); // Ensure you have the correct path to your user model
const { generateAccessAndRefreshTokens } = require("../utils/generateAccessAndRefreshTokens"); // Ensure this utility is correctly implemented and imported
const ApiResponse = require("../utils/ApiResponse");; // For consistent response format
const { ApiError } = require("../utils/ApiError"); // For error handling

const successGoogleLogin = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Google Authentication Failed");
    }

    const { email, displayName } = req.user; // Assuming `req.user` contains `email` and `displayName` from Google profile
    if (!email || !displayName) {
      throw new ApiError(400, "Incomplete Google Profile Information");
    }

    let user = await Users.findOne({ email });

    if (!user) {
      user = await Users.create({
        fullName: displayName,
        email,
      });
      console.log("New user created:", user);
    } else {
      console.log("Existing user found:", user);
    }

    // Generate access and refresh tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    // Set cookies for tokens
    const options = {
      httpOnly: true,
      secure: true, // Ensure HTTPS is used in production
    };

    return res
      .status(200)
      .cookie('user', JSON.stringify({ accessToken, options, refreshToken, user }), {
        httpOnly: false,    // Makes the cookie accessible only by the server
        secure: false,      // Ensures cookie is sent over HTTPS
        sameSite: 'Lax', // Can be 'Strict', 'Lax', or 'None'
        maxAge: 3600000,   // 1 hour in milliseconds
      })
      .redirect(`${process.env.FRONTEND_BASE_URL}/taskmanagement`)
    //   .json(
    //     new ApiResponse(
    //       200,
    //       {
    //         user: {
    //           fullName: user.fullName,
    //           email: user.email,
    //         },
    //         accessToken,
    //         refreshToken,
    //       },
    //       "Google Authentication Successful"
    //     )
    //   );
  } catch (error) {
    next(error); // Pass the error to your global error handler
  }
};

const failureGoogleLogin = (req, res) => {
  res.status(401).json(new ApiResponse(401, null, "Google Authentication Failed"));
};

module.exports = {
  successGoogleLogin,
  failureGoogleLogin,
};
