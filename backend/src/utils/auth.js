import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;

// Hash user password
export const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

// Compare plain-text password with hashed password
export const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

// Generate JWT Token
export const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '24h',
    });
};
