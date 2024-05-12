// models/User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  online: Boolean,
  status: String
});

module.exports = mongoose.model('User', userSchema);
