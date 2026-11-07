import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AcademicYearTenantGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const tenantId = Number(request.tenantId || request.headers['x-tenant-id'] || 1);
    if (!Number.isSafeInteger(tenantId) || tenantId < 1 || tenantId !== Number(request.user?.tenantId)) {
      throw new ForbiddenException('Bạn chỉ được quản lý năm học của trường đang đăng nhập.');
    }
    return true;
  }
}
