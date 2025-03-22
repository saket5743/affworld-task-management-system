const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../utils/ApiError");
const Users = require("../models/user.model");
const ApiResponse = require("../utils/ApiResponse");
const jwt = require("jsonwebtoken");
const crypto = require('crypto');
const { default: mongoose } = require("mongoose");
const transporter = require("../utils/configs/nodeMailerConfig");
const { generateAccessAndRefreshTokens } = require("../utils/generateAccessAndRefreshTokens"); 


const registerUser = asyncHandler(async (req, resp) => {
  console.log("register called");

  const { fullName, email, password } = req.body;
  console.log("reqbody", req.body);

  if (
    [fullName, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All Fields are required");
  }

  const existedUser = await Users.findOne({
    $or: [{ fullName }, { email }],
  });
  console.log("existedUser", existedUser);

  if (existedUser) {
    resp.status(409).json({ statusCode: 409, success: false, message: `user with ${email} or ${fullName} is already exist.` });
  }

  const user = await Users.create({
    fullName,
    email,
    password
  });

  const createdUser = await Users.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    resp.status(500).json({ statusCode: 500, success: false, message: `Something went wrong while creating user` });
  }

  return resp
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered Successfully"));
});

const loginUser = asyncHandler(async (req, resp) => {
  console.log("login called");

  const { fullName, email, password } = req.body;
  if (!(fullName || email)) {
    resp.status(400).json({ statusCode: 400, success: false, message: `fullName or email is required.` })
  }

  const user = await Users.findOne({
    $or: [{ fullName }, { email }],
  });

  if (!user) {
    resp.status(400).json({ statusCode: 400, success: false, message: `user does not exists.` })
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    resp.status(400).json({ statusCode: 400, success: false, message: `Invalid Credentials.` })
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await Users.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return resp
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, resp) => {
  await Users.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return resp
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user looged out"));
});

const refreshAccessToken = asyncHandler(async (req, resp) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  console.log("requestedbody", req.cookies);
  console.log("incomingRefreshToken", incomingRefreshToken);

  if (!incomingRefreshToken) {
    resp.status(401).status({ statusCode: 401, success: false, message: `Unauthorized Request.` })
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECERET
    );

    const user = await Users.findById(decodedToken._id);

    if (!user) {
      resp.status(401).status({ statusCode: 401, success: false, message: `Invalid refresh token.` })
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      resp.status(401).status({ statusCode: 401, success: false, message: `Refresh token is expired or used.` });
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return resp
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentUserPassword = asyncHandler(async (req, resp) => {
  const { oldPassword, newPassword } = req.body;

  const user = await Users.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    resp.status(400).status({ statusCode: 400, success: false, message: `Invalid old password.` });
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return resp
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, resp) => {
  return resp
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"));
});


const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ statusCode: 400, success: false, message: `Email is required.` });
  }

  const user = await Users.findOne({ email });

  if (!user) {
    res.status(404).json({ statusCode: 404, success: false, message: `User with the provided email does not exist.` });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = Date.now() + 15 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_BASE_URL}/forgot-password/${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: user.email,
    subject: "Password Reset Request",
    text: `You requested a password reset. Use this link to reset your password: ${resetUrl}. This link is valid for 15 minutes.`,
  };
  console.log("mailOptions", mailOptions)

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json(new ApiResponse(200, {}, "Password reset link sent to email"));
  } catch (error) {
    console.log(error)
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(500).json({ statusCode: 500, success: false, message: `Error sending password reset email.` });
  }

});


const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    res.status(400).json({ statusCode: 400, success: false, message: `New password is required.` });
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await Users.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400).json({ statusCode: 400, success: false, message: `Invalid or expired reset token.` });
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.status(200).json(new ApiResponse(200, {}, "Password reset successful"));
});

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentUserPassword,
  getCurrentUser,
  forgotPassword,
  resetPassword,
};