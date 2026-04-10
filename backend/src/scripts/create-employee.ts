import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1️⃣ Buscar la empresa existente
  const empresa = await prisma.empresa.findFirst();

  if (!empresa) {
    throw new Error('No existe ninguna empresa en la base de datos.');
  }

  // 2️⃣ Encriptar contraseña
  const hashedPassword = await bcrypt.hash('Empleado123*', 10);

  // 3️⃣ Crear usuario EMPLEADO
  const empleado = await prisma.usuario.create({
    data: {
      nombre: 'Empleado 1',
      email: 'empleado@sasprestamos.com',
      password: hashedPassword,
      rol: Rol.EMPLEADO,
      empresaId: empresa.id,
    },
  });

  console.log('✅ EMPLEADO creado correctamente');
  console.log('Empresa:', empresa.nombre);
  console.log('Email:', empleado.email);
  console.log('Password: Empleado123*');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



  // ejecutar npx ts-node scripts/create-employee.ts