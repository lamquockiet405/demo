import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AcademicYearTenantGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const userTenantId = Number(request.user?.tenantId || request.user?.schoolId || 1);
    const tenantId = Number(request.tenantId || request.headers['x-tenant-id'] || userTenantId);
    if (!Number.isSafeInteger(tenantId) || tenantId < 1 || (request.user?.tenantId && tenantId !== userTenantId)) {
      throw new ForbiddenException('Bạn chỉ được quản lý năm học của trường đang đăng nhập.');
    }
    return true;
  }
}
