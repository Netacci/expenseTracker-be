import jwt from 'jsonwebtoken';
import User from './../models/v1/users/auth.js';

const authenticate = (userType) => {
  return async (req, res, next) => {
    try {
      const token = req.cookies.token;
      if (!token) {
        return res
          .status(401)
          .json({ message: 'Access denied. No token provided.' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { email, _id } = decoded;

      let user;

      if (userType === 'user') {
        user = await User.findOne({ email });
      } else if (userType === 'admin') {
        user = await Admin.findOne({ email });
      } else {
        return res.status(401).json({ message: 'Authentication failed' });
      }

      if (!user) {
        return res.status(401).json({ message: 'Authentication failed' });
      }
      req.user = user;
      next();
    } catch (err) {
      return res
        .status(401)
        .json({ message: err.message || 'Invalid or expired token' });
    }
  };
};

// const authenticate = (userType) => {
//   return async (req, res, next) => {

//     try {
//       const token = req.cookies.token;
//       if (!token) {
//         return res.status(401).json({ message: 'Access denied. No token provided.' });
//       }

//       const { email, _id } = jwt.verify(token, process.env.JWT_SECRET);
//       let user;

//       if (userType === 'user') {
//         user = await User.findOne({ email });
//       } else if (userType === 'admin') {
//         user = await Admin.findOne({ email });
//       } else {
//         return res.status(401).send({ message: 'Authentication failed' });
//       }

//       if (!user) {
//         return res.status(401).send({ message: 'Authentication failed' });
//       }

//       req.user = user;
//       next();
//     } catch (err) {
//       return res.status(401).json({ message: err.message });
//     }
//   };
// };

export default authenticate;
