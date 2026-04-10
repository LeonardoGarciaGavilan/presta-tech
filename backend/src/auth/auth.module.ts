import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt/jwt.strategy';
import { RolesGuard } from './roles/roles.guard';
import { TokenCleanupService } from './token-cleanup.service';
import { StringValue } from 'ms';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret', 'super_secret_key'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn', '1d') as StringValue,
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, RolesGuard, TokenCleanupService],
  controllers: [AuthController],
  exports: [JwtModule],
})
export class AuthModule {}
