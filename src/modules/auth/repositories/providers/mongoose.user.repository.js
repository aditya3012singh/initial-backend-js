import { IUserRepository } from '../user.repository.interface.js';
import { UserModel } from '../../models/user.model.js';

export class MongooseUserRepository extends IUserRepository {
    async findById(id) {
        return UserModel.findById(id).exec();
    }

    async findByEmail(email) {
        return UserModel.findOne({ email }).exec();
    }

    async findByResetToken(token) {
        return UserModel.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gte: new Date() }
        }).exec();
    }

    async create(data) {
        const user = new UserModel(data);
        return user.save();
    }

    async update(id, data) {
        return UserModel.findByIdAndUpdate(id, data, { new: true }).exec();
    }

    async updateByEmail(email, data) {
        return UserModel.findOneAndUpdate({ email }, data, { new: true }).exec();
    }
}
