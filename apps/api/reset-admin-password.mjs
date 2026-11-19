import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

try {
  const email = 'admin@dusknyt.com';
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 12) {
    throw new Error('Password must be at least 12 characters.');
  }

  const admin = await prisma.user.findUnique({ where: { email } });

  if (!admin) {
    throw new Error('Admin account not found.');
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(admin.role)) {
    throw new Error('Account does not have an admin role. No changes made.');
  }

  await prisma.user.update({
    where: { email },
    data: { passwordHash: await bcrypt.hash(password, 12) }
  });

  console.log('Admin password reset successfully!');
} catch (error) {
  console.error('Password reset failed:', error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
