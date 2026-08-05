import { PrismaUserRepository } from './providers/prisma.user.repository.js';

const userRepository = new PrismaUserRepository();
export default userRepository;
