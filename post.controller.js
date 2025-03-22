const Post = require("../models/post.model");
const mongoose = require("mongoose");
const userModel = require("../models/user.model");
const { ApiError } = require("../utils/ApiError");
const { asyncHandler } = require("../utils/asyncHandler");
const { uploadOnCloudinary } = require("../utils/cloudinary");

// Create a new post
const createPost = asyncHandler(async (req, res) => {
  const { caption } = req.body;
  const { id: userId } = req.params; // Ensure this matches the route parameter name
  const photoBuffer = req.file?.buffer;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    // throw new ApiError(400, "Invalid or missing User ID.");
    res.status(400).status({ statusCode: 400, success: false, message: `Invalid or missing User ID.` });
  }

  if (!photoBuffer) {
    // throw new ApiError(400, "Photo is required.");
    res.status(400).status({ statusCode: 400, success: false, message: `Photo is required.` });
  }

  const uploadedPhoto = await uploadOnCloudinary(photoBuffer);

  if (!uploadedPhoto?.url) {
    // throw new ApiError(500, "Failed to upload photo on Cloudinary.");
    res.status(500).status({ statusCode: 500, success: false, message: `Failed to upload photo on Cloudinary.` });
  }

  const user = await userModel.findById(userId);

  if (!user) {
    // throw new ApiError(404, "User not found.");
    res.status(400).status({ statusCode: 400, success: false, message: `User not found.` });
  }

  const post = await Post.create({
    photo: uploadedPhoto.url,
    caption,
    user: userId,
  });

  if (!post) {
    // throw new ApiError(500, "Failed to create post.");
    res.status(500).status({ statusCode: 500, success: false, message: `Failed to create post.` });
  }

  res.status(201).json({ success: true, message: "Post created successfully.", post });
});

// Get All Posts
const getAllPosts = asyncHandler(async (req, res) => {
  const posts = await Post.find().populate("user", "fullName userName").sort({ createdAt: -1 });
  res.status(200).json({ success: true, posts });
});

// Get Post by ID
const getPostById = asyncHandler(async (req, res) => {
  const { id: postId } = req.params;
  const post = await Post.findById({ _id: postId }).populate("user", "fullName userName");

  if (!post) {
    // throw new ApiError(404, "Post not found.")
    res.status(404).status({ statusCode: 404, success: false, message: `Post not found.` });
  }
  res.status(200).json({ success: true, post });
});

// Update a post
const updatePost = asyncHandler(async (req, res) => {
  const { caption } = req.body;
  const { id: postId } = req.params;
  const post = await Post.findById({ _id: postId });

  if (!post) {
    // throw new ApiError(404, "Post not found.");
    res.status(404).status({ statusCode: 404, success: false, message: `Post not found.` });
  }

  if (req.user._id.toString() !== post.user.toString()) {
    // throw new ApiError(403, "Unauthorized to update this post")
    res.status(403).status({ statusCode: 403, success: false, message: `Unauthorized to update this post.` });
  }

  if (req.file) {
    const uploadedPhoto = await uploadOnCloudinary(req.file.buffer);
    if (uploadedPhoto && uploadedPhoto.url) {
      post.photo = uploadedPhoto.url;
    }
  }

  post.caption = caption || post.caption;
  await post.save();

  res.status(200).json({ success: true, message: "Post updated successfully.", post });
});

// Delete a post
const deletePost = asyncHandler(async (req, res) => {
  const { id: postId } = req.params;

  // Find the post
  const post = await Post.findById(postId);

  if (!post) {
    return res.status(404).json({ 
      statusCode: 404, 
      success: false, 
      message: "Post not found." 
    });
  }

  // Check if the logged-in user owns the post
  if (req.user._id.toString() !== post.user.toString()) {
    return res.status(403).json({ 
      statusCode: 403, 
      success: false, 
      message: "Unauthorized to delete this post." 
    });
  }

  // Delete the post
  await Post.deleteOne({ _id: postId });

  return res.status(200).json({ 
    statusCode: 200, 
    success: true, 
    message: "Post deleted successfully." 
  });
});

module.exports = {
  createPost,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost
}

