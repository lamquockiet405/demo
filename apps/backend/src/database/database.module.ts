import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as pg from 'pg';

// Automatically parse PostgreSQL int8 (bigint/BIGSERIAL, OID 20) as JavaScript numbers
pg.types.setTypeParser(20, (val: string) => (val === null ? null : parseInt(val, 10)));
// Keep PostgreSQL DATE (OID 1082) as 'YYYY-MM-DD' string to prevent JS Date.toString() ("GMT+0700") errors in SQL
pg.types.setTypeParser(1082, (val: string) => val);

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        autoLoadEntities: true,
        synchronize: false,
        // PostgreSQL không nhận alias "gmt+0700" có thể tồn tại trong cấu hình
        // role/database. Ép timezone hợp lệ cho từng connection của TypeORM.
        extra: {
          options: '-c timezone=Asia/Ho_Chi_Minh',
        },
        logging: configService.get<string>('nodeEnv') === 'development' ? ['error', 'warn'] : false,
        ssl: false,
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
