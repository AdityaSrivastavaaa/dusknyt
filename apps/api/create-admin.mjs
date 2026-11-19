import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

try {
  const email = 'admin@dusknyt.com';

  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    throw new Error('This email already exists. No changes made.');
  }

  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 12) {
    throw new Error('Admin password must be at least 12 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'DUSKNYT Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE'
    }
  });

  console.log('Super Admin created successfully:', admin.email);
} catch (error) {
  console.error('Admin creation failed:', error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
