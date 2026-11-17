import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AllergyWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    const roles = (user?.roles || []).map((role: any) => String(typeof role === 'string' ? role : role.code).toUpperCase());
    const manager = roles.some((role: string) => ['SCHOOL_MANAGER', 'SCHOOL_MANAGEMENT', 'PRINCIPAL', 'SUPER_ADMIN'].includes(role));
    if (roles.includes('NUTRITIONIST') && !manager) {
      throw new ForbiddenException('Chuyên viên dinh dưỡng chỉ được xem thông tin dị ứng và chế độ ăn.');
    }
    return true;
  }
}
