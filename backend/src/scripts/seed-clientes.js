const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EMPRESA_ID = "5992c3a6-290c-469d-b83d-23438892438c";

const nombres = ["Juan","Pedro","Luis","Carlos","Miguel","Jose","Rafael","Daniel","Andres","David","Manuel","Antonio","Francisco","Jorge","Victor","Ricardo","Alberto","Mario"];
const apellidos = ["Garcia","Rodriguez","Perez","Martinez","Sanchez","Ramirez","Torres","Flores","Rivera","Gomez","Diaz","Vargas","Castro","Ortega","Medina","Herrera"];

function random(arr){
 return arr[Math.floor(Math.random()*arr.length)];
}

function telefono(){
 return `809-${Math.floor(100+Math.random()*900)}-${Math.floor(1000+Math.random()*9000)}`
}

function cedula(i){
 return `402000${1000+i}`
}

function randomMonto(){
 return Math.floor(5000 + Math.random()*50000)
}

function randomCuotas(){
 const opciones=[6,8,10,12]
 return random(opciones)
}

function calcularFechaVencimiento(fechaInicio, cuotas){
 const fecha = new Date(fechaInicio)
 fecha.setMonth(fecha.getMonth()+cuotas)
 return fecha
}

async function main(){

console.log("Creando clientes...")

const clientes=[]

for(let i=1;i<=200;i++){

const nombre=random(nombres)
const apellido=random(apellidos)

clientes.push({
 nombre,
 apellido,
 cedula:cedula(i),
 telefono:telefono(),
 celular:telefono(),
 provincia:"Duarte",
 municipio:"San Francisco de Macoris",
 sector:"Centro",
 direccion:`Calle ${i}`,
 ocupacion:"Empleado",
 ingresos:Math.floor(20000+Math.random()*40000),
 empresaId:EMPRESA_ID
})

}

await prisma.cliente.createMany({
 data:clientes,
 skipDuplicates:true
})

console.log("Clientes creados")

const clientesDB = await prisma.cliente.findMany({
 where:{empresaId:EMPRESA_ID}
})

console.log("Creando prestamos...")

const prestamos=[]

for(let i=0;i<150;i++){

const cliente=random(clientesDB)

const monto=randomMonto()
const cuotas=randomCuotas()

const interes=0.20
const montoTotal=monto*(1+interes)

const cuotaMensual=montoTotal/cuotas

const fechaInicio=new Date()

prestamos.push({
 monto,
 tasaInteres:20,
 numeroCuotas:cuotas,
 montoTotal,
 saldoPendiente:montoTotal,
 cuotaMensual,
 frecuenciaPago:"MENSUAL",
 fechaInicio,
 fechaVencimiento:calcularFechaVencimiento(fechaInicio,cuotas),
 estado:"ACTIVO",
 empresaId:EMPRESA_ID,
 clienteId:cliente.id
})

}

const prestamosInsertados = await prisma.prestamo.createMany({
 data:prestamos
})

console.log("Prestamos creados")

const prestamosDB = await prisma.prestamo.findMany({
 where:{empresaId:EMPRESA_ID}
})

console.log("Creando cuotas...")

const cuotas=[]

for(const prestamo of prestamosDB){

for(let i=1;i<=prestamo.numeroCuotas;i++){

const fecha=new Date(prestamo.fechaInicio)
fecha.setMonth(fecha.getMonth()+i)

cuotas.push({
 numero:i,
 monto:prestamo.cuotaMensual,
 capital:prestamo.cuotaMensual*0.8,
 interes:prestamo.cuotaMensual*0.2,
 fechaVencimiento:fecha,
 prestamoId:prestamo.id
})

}

}

await prisma.cuota.createMany({
 data:cuotas
})

console.log("Cuotas creadas")

console.log("Datos generados correctamente")

}

main()
.catch(e=>{
 console.error(e)
})
.finally(async()=>{
 await prisma.$disconnect()
})