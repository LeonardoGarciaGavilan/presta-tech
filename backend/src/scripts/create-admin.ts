import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Admin123*', 10);

  // 1️⃣ Crear Empresa
  const empresa = await prisma.empresa.create({
    data: {
      nombre: 'Gavilan Prestamos',
      activa: true,
    },
  });

  // 2️⃣ Crear Configuración
  await prisma.configuracion.create({
    data: {
      empresaId: empresa.id,
      tasaInteresBase: 10,
      moraPorcentajeMensual: 5,
      diasGracia: 5,
      permitirAbonoCapital: true,
    },
  });

  // 3️⃣ Crear Usuario ADMIN
  const admin = await prisma.usuario.create({
    data: {
      nombre: 'Antonio Gavilan',
      email: 'gavilan@gmail.com',
      password: hashedPassword,
      rol: Rol.ADMIN,
      empresaId: empresa.id,
    },
  });

  console.log('✅ ADMIN creado correctamente');
  console.log('Email:', admin.email);
  console.log('Password: Admin123*');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




  // ejecutar npx ts-node scripts/create-admin.ts