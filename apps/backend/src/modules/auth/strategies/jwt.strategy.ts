import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

export interface JwtPayload {
  sub: any;
  email: string;
  roles: string[];
  tenantId: any;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: ['roles'],
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa');
    }

    const roleCodes = user.roles?.map((r) => r.code) || payload.roles || [];
    if (roleCodes.includes('SCHOOL_MANAGER') && !roleCodes.includes('PRINCIPAL')) {
      roleCodes.push('PRINCIPAL');
    }

    const resolvedTenantId = user.tenantId || payload.tenantId || '1';

    return {
      id: String(user.id),
      sub: user.id,
      userId: String(user.id),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatar,
      roles: roleCodes,
      tenantId: String(resolvedTenantId),
    };
  }
}
