import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import User from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false }); // Save without running validators

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Error generating tokens");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // Registration logic here
  // return res.status(200).json({ message: "User registered successfully" });

  const { fullName, email, username, password } = req.body;

  if (
    [fullName, email, username, password].some((field) => field.trim() === "")
  ) {
    throw new ApiError("400, All fields are required");
  }

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    throw new ApiError("409, User with given email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError("400, Avatar Image is required");
  }

  // Upload to cloudinary can be done here
  const avatarUploadResponse = await uploadOnCloudinary(avatarLocalPath);
  const coverImageUploadResponse = coverImageLocalPath
    ? await uploadOnCloudinary(coverImageLocalPath)
    : null;

  if (!avatarUploadResponse) {
    throw new ApiError("500, Failed to upload avatar image");
  }

  const user = await User.create({
    fullName,
    email,
    username: username.toLowerCase(),
    password,
    avatar: avatarUploadResponse.url || null,
    coverImage: coverImageUploadResponse?.url || null,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken -__v"
  ); //Exclude password, refreshToken, and __v fields

  if (!createdUser) {
    throw new ApiError("500, Failed to create user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // Login logic here
  const { username, password } = req.body;

  if ([username, password].some((field) => field.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  // const user  = await User.findOne({ $or: [{ email: username.toLowerCase() }, { username: username.toLowerCase() }] });
  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -__v"
  ); //Exclude password, refreshToken, and __v fields

  // Send tokens in response
  const options = {
    httpOnly: true,
    secure: true,
    // sameSite: "Strict",
    // maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  return res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findByIdAndUpdate(userId, {
    $set: { refreshToken: undefined },
  });

  const options = {
    httpOnly: true,
    secure: true,
    // sameSite: "Strict",
    // maxAge: 0, // Expire immediately
  };

  return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const _refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  if (!_refreshToken) {
    throw new ApiError(401, "Unauthorized - Refresh token is missing");
  }

  let decodedToken;
  try {
    decodedToken = jwt.verify(_refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (user.refreshToken !== _refreshToken) {
      throw new ApiError(401, "Refresh token does not match");
    }

    console.log("hellow");
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: true,
      // sameSite: "Strict",
      // maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
