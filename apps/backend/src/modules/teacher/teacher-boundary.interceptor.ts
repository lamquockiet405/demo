import {CallHandler,ExecutionContext,ForbiddenException,Injectable,NestInterceptor} from '@nestjs/common';

@Injectable()
export class TeacherBoundaryInterceptor implements NestInterceptor{
 intercept(context:ExecutionContext,next:CallHandler){
  const req=context.switchToHttp().getRequest(),roles=(req.user?.roles||[]).map((r:any)=>typeof r==='string'?r:r.code);
  const teacher=roles.includes('TEACHER')&&!roles.some((r:string)=>['PRINCIPAL','SCHOOL_MANAGER','SCHOOL_MANAGEMENT','SUPER_ADMIN','NUTRITIONIST','PARENT'].includes(r));
  const path=(req.originalUrl||req.url||'').split('?')[0].replace(/^\/api\/v1/,'');
  if(teacher&&!path.startsWith('/teacher/')&&!path.startsWith('/auth/')&&!['/users/profile','/tenant/profile'].includes(path))throw new ForbiddenException('Giáo viên sử dụng API trong phạm vi lớp được phân công.');
  return next.handle();
 }
}
