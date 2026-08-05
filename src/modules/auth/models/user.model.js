import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true, index: true },
        username: { type: String, required: true, unique: true },
        password: { type: String },
        role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
        profilePic: { type: String, default: null },
        linkedin: { type: String, default: null },
        github: { type: String, default: null },
        refreshTokenHash: { type: String, default: null },
        tokenVersion: { type: Number, default: 0 },
        resetPasswordToken: { type: String, default: null },
        resetPasswordExpires: { type: Date, default: null },
        loginAttempts: { type: Number, default: 0 },
        lockUntil: { type: Date, default: null },
    },
    {
        timestamps: true,
    }
);

UserSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

UserSchema.set('toJSON', {
    virtuals: true,
    transform: (_, ret) => {
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

export const UserModel = mongoose.model('User', UserSchema);
