import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';  // 👈 agregar
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { Keyv } from 'keyv';
import KeyvRedis from '@keyv/redis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsuarioModule } from './usuario/usuario.module';
import { ClientesModule } from './clientes/clientes.module';
import { PrestamosModule } from './prestamos/prestamos.module';
import { PagosModule } from './pagos/pagos.module';
import { ConfiguracionModule } from './configuracion/configuracion.module';
import { PerfilModule } from './perfil/perfil.module';
import { ReportesModule } from './reportes/reportes.module';
import { GastosModule } from './gastos/gastos.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { CajaModule } from './caja/caja.module';
import { SuperAdminModule } from './superadmin/superadmin.module';
import { RutasModule } from './rutas/rutas.module';
import { AlertsModule } from './alerts/alerts.module';
import { FinanzasModule } from './finanzas/finanzas.module';
import { EmpleadosModule } from './empleados/empleados.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { DashboardModule } from './dashboard/dashboard.module';
import jwtConfig from './config/jwt.config';   // 👈 agregar

@Module({
  imports: [
    // ─── Configuración global ─────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,          // disponible en toda la app sin importarlo
      load: [jwtConfig],       // carga tu config centralizada
    }),

    // ─── Caché global con Redis (opcional) ───────────────────────────────────
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const redisUrl = process.env.REDIS_URL;
        const redisHost = process.env.REDIS_HOST;
        const redisPort = process.env.REDIS_PORT || 6379;

        if (!redisUrl && (!redisHost || redisHost === 'localhost')) {
          console.warn('⚠️ Redis no configurado, usando cache en memoria');
          return {};
        }

        console.log('🔄 Redis cache habilitado');
        return {
          stores: [
            new Keyv({
              store: new KeyvRedis(redisUrl || `redis://${redisHost}:${redisPort}`),
              namespace: 'sas',
            }),
          ],
        };
      },
    }),

    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60_000, limit: 100 },
      { name: 'login', ttl: 300_000, limit: 10 },
      { name: 'refresh', ttl: 60_000, limit: 100 },
      { name: 'password', ttl: 300_000, limit: 3 },
    ]),

    PrismaModule,
    AuthModule,
    UsuarioModule,
    ClientesModule,
    PrestamosModule,
    PagosModule,
    ConfiguracionModule,
    PerfilModule,
    ReportesModule,
    GastosModule,
    NotificacionesModule,
    CajaModule,
    SuperAdminModule,
    RutasModule,
    AlertsModule,
    FinanzasModule,
    EmpleadosModule,
    AuditoriaModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}