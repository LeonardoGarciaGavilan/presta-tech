// scripts/create-superadmin.ts
// Ejecutar UNA sola vez: npx ts-node scripts/create-superadmin.ts
// Crea el usuario SUPERADMIN que controla todas las empresas

import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const EMAIL    = 'garcia18leonardo18@gmail.com';   // ◄ cambia esto
  const PASSWORD = 'Antonioredminote8';           // ◄ cambia esto
  const NOMBRE   = 'Super Administrador';       // ◄ cambia esto

  // Verificar que no exista ya
  const existe = await prisma.usuario.findUnique({ where: { email: EMAIL } });
  if (existe) {
    console.log('⚠️  Ya existe un usuario con ese email');
    return;
  }

  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  const superAdmin = await prisma.usuario.create({
    data: {
      nombre:              NOMBRE,
      email:               EMAIL,
      password:            hashedPassword,
      rol:                 Rol.SUPERADMIN,
      activo:              true,
      debeCambiarPassword: false,
      empresaId:           null, // SUPERADMIN no pertenece a ninguna empresa
    },
  });

  console.log('✅ SUPERADMIN creado correctamente');
  console.log('Email:   ', superAdmin.email);
  console.log('Password:', PASSWORD);
  console.log('\n⚠️  Guarda estas credenciales en un lugar seguro y elimina este script.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });