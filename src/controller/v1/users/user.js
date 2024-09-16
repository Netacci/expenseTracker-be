import User from '../../../models/v1/users/auth.js';
import bcrypt from 'bcryptjs';

const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      'first_name is_email_verified email id _id'
    );
    res.status(200).json({ data: user, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    res
      .status(200)
      .json({ message: 'Profile deleted successfully', status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  try {
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (oldPassword === newPassword) {
      return res
        .status(401)
        .json({ message: 'New password cannot be the same as old password' });
    }
    const match = await bcrypt.compare(oldPassword, req.user.password);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    req.user.password = hashedPassword;
    await req.user.save();
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const editProfile = async (req, res) => {
  const { first_name } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { first_name },
      { new: true }
    );
    res
      .status(200)
      .json({ data: user, status: 200, message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export { getUser, deleteUser, changePassword, editProfile };
