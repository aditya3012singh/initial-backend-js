import DBWrapper from '../../../../core/config/db.wrapper.js';
import { IUserRepository } from '../user.repository.interface.js';
import { UserModel } from '../../models/user.model.js';

export class MongooseUserRepository extends IUserRepository {
    async findById(id) {
        return DBWrapper.execute('mongooseUserRepoFindById', () =>
            UserModel.findById(id).exec()
        );
    }

    async findByEmail(email) {
        return DBWrapper.execute('mongooseUserRepoFindByEmail', () =>
            UserModel.findOne({ email }).exec()
        );
    }

    async findByUsername(username) {
        return DBWrapper.execute('mongooseUserRepoFindByUsername', () =>
            UserModel.findOne({ username }).exec()
        );
    }

    async findByEmailOrUsername(email, username) {
        return DBWrapper.execute('mongooseUserRepoFindByEmailOrUsername', () =>
            UserModel.findOne({ $or: [{ email }, { username }] }).exec()
        );
    }

    async findByResetToken(token) {
        return DBWrapper.execute('mongooseUserRepoFindByResetToken', () =>
            UserModel.findOne({
                resetPasswordToken: token,
                resetPasswordExpires: { $gte: new Date() }
            }).exec()
        );
    }

    async create(data) {
        return DBWrapper.execute('mongooseUserRepoCreate', () => {
            const user = new UserModel(data);
            return user.save();
        });
    }

    async update(id, data) {
        return DBWrapper.execute('mongooseUserRepoUpdate', () =>
            UserModel.findByIdAndUpdate(id, data, { new: true }).exec()
        );
    }

    async updateByEmail(email, data) {
        return DBWrapper.execute('mongooseUserRepoUpdateByEmail', () =>
            UserModel.findOneAndUpdate({ email }, data, { new: true }).exec()
        );
    }

    async findOrCreateOAuthUser(data) {
        return DBWrapper.execute('mongooseUserRepoFindOrCreateOAuth', () =>
            UserModel.findOneAndUpdate(
                { email: data.email },
                {
                    $setOnInsert: { username: data.username, password: '' },
                    $set: { profilePic: data.profilePic }
                },
                { upsert: true, new: true }
            ).exec()
        );
    }
}
