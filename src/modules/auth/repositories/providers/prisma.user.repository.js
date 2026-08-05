import DBWrapper from '../../../../core/config/db.wrapper.js';
import { IUserRepository } from '../user.repository.interface.js';

export class PrismaUserRepository extends IUserRepository {
    async findById(id) {
        return DBWrapper.execute('userRepoFindById', (db) =>
            db.user.findUnique({ where: { id } })
        );
    }

    async findByEmail(email) {
        return DBWrapper.execute('userRepoFindByEmail', (db) =>
            db.user.findUnique({ where: { email } })
        );
    }

    async findByResetToken(token) {
        return DBWrapper.execute('userRepoFindByResetToken', (db) =>
            db.user.findFirst({
                where: {
                    resetPasswordToken: token,
                    resetPasswordExpires: { gte: new Date() }
                }
            })
        );
    }

    async create(data) {
        return DBWrapper.execute('userRepoCreate', (db) =>
            db.user.create({ data })
        );
    }

    async update(id, data) {
        return DBWrapper.execute('userRepoUpdate', (db) =>
            db.user.update({
                where: { id },
                data
            })
        );
    }

    async updateByEmail(email, data) {
        return DBWrapper.execute('userRepoUpdateByEmail', (db) =>
            db.user.update({
                where: { email },
                data
            })
        );
    }
}
