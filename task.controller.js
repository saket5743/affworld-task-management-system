const Task = require('../models/task.model');
const userModel = require('../models/user.model');
const mongoose = require('mongoose');
const ApiResponse = require('../utils/ApiResponse');
const { asyncHandler } = require('../utils/asyncHandler');

const createTask = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { id: userId } = req.params;

  console.log("task called", req.body, req.params);

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    res.status(400).status({ statusCode: 400, success: false, message: `Invalid or missing User ID.` });
  }

  if (!name) {
    res.status(400).status({ statusCode: 400, success: false, message: `Task name is required.` });
  }

  const user = await userModel.findById(userId);

  if (!user) {
    res.status(400).status({ statusCode: 400, success: false, message: `User not found.` });
  }

  const task = await Task.create({ name, description, user });

  if (!task) {
    res.status(400).status({ statusCode: 400, success: false, message: `Task not created.` });
  }

  res.status(201).json(new ApiResponse(201, task, "Task created successfully"));
});

const getTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({}, "name description status user")
    .populate("user", "fullName _id")
    .sort({ createdAt: -1 });

  if (!tasks || tasks.length === 0) {
    return res.status(404).json({
      statusCode: 404,
      success: false,
      message: "No tasks found."
    });
  }

  const statusMapping = {
    Pending: "af1",
    Completed: "af4",
    Done: "af7"
  };

  const INITIAL_DATA = [
    { id: "af1", label: "Pending", items: [], tint: 1 },
    { id: "af4", label: "Completed", items: [], tint: 2 },
    { id: "af7", label: "Done", items: [], tint: 3 }
  ];

  const transformedTasks = INITIAL_DATA.map(category => ({
    ...category,
    items: tasks
      .filter(task => statusMapping[task.status] === category.id)
      .map(task => ({
        id: task._id.toString(),
        name: task.name,
        description: task.description,
        user: task.user
          ? {
            _id: task.user._id,
            fullName: task.user.fullName
          }
          : null
      }))
  }));

  res.status(200).json({
    statusCode: 200,
    success: true,
    message: "All tasks found.",
    data: transformedTasks
  });
});

const getTaskById = asyncHandler(async (req, res) => {
  const { id: taskId } = req.params;
  const task = await Task.findById({ _id: taskId });
  if (!task) {
    res.status(404).status({ statusCode: 404, success: false, message: `Task not found.` });
  }
  res.status(200).json(new ApiResponse(200, task, "Task found"));
});

const updateTask = asyncHandler(async (req, res) => {
  const { id: taskId } = req.params;
  const task = await Task.findByIdAndUpdate({ _id: taskId }, req.body, {
    new: true,
    runValidators: true,
    overwrite: true
  });
  if (!task) {
    res.status(400).status({ statusCode: 400, success: false, message: `Task not updated.` });
  }
  res.status(200).json(new ApiResponse(200, task, "Task updated successfully"));
});

const deleteTask = asyncHandler(async (req, res) => {
  const { id: taskId } = req.params;
  const task = await Task.findByIdAndDelete({ _id: taskId });
  if (!task) {
    res.status(400).status({ statusCode: 400, success: false, message: `Task not deleted.` });
  }
  res.status(200).json(new ApiResponse(200, {}, "Task deleted successfully"));
});

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask
}