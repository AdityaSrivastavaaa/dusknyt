import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@dusknyt.com' },
    select: {
      email: true,
      role: true,
      status: true,
      passwordHash: true
    }
  });

  console.log(user
    ? {
        email: user.email,
        role: user.role,
        status: user.status,
        hasPassword: Boolean(user.passwordHash)
      }
    : 'NOT FOUND'
  );
} catch (error) {
  console.error(error.message);
} finally {
  await prisma.$disconnect();
}
