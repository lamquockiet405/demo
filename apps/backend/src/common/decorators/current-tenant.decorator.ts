import { createParamDecorator, ExecutionContext } from '@nestjs/common';

const isUuid = (val?: unknown): val is string =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const userTenantId = request.user?.tenantId;
    const reqTenantId = request.tenantId;

    if (isUuid(userTenantId)) {
      return userTenantId;
    }
    if (isUuid(reqTenantId)) {
      return reqTenantId;
    }
    return String(userTenantId || reqTenantId || '1');
  },
);
