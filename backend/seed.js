const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const data = JSON.parse(fs.readFileSync('../db.json', 'utf-8'));
  
  // Seed Users
  for (const user of data.users) {
    // If the password is not hashed (like 'superuefs'), hash it. Otherwise use the hash.
    let password = user.password;
    if (!password.startsWith('$2b$')) {
      const salt = bcrypt.genSaltSync(10);
      password = bcrypt.hashSync(password, salt);
    }

    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        id: user.id,
        email: user.email,
        password: password,
        role: user.role
      }
    });
  }
  
  console.log('Usuários importados.');

  // Seed Logs
  for (const log of data.logs) {
    try {
      await prisma.log.upsert({
        where: { id: log.id },
        update: {},
        create: {
          id: log.id,
          name: log.name,
          role: log.role,
          date: log.date,
          entryTime: log.entryTime,
          lunchStart: log.lunchStart || null,
          lunchEnd: log.lunchEnd || null,
          exitTime: log.exitTime || null,
          status: log.status,
          createdAt: log.createdAt ? new Date(log.createdAt) : new Date(),
          userId: log.userId
        }
      });
    } catch (e) {
      console.log(`Erro ao importar log ${log.id}: ${e.message}`);
    }
  }

  console.log('Logs importados.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
