import { Test } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { TeacherModule } from '../../../src/modules/teacher/teacher.module';
import { TeacherController } from '../../../src/modules/teacher/teacher.controller';
import { TeacherService } from '../../../src/modules/teacher/teacher.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';

describe('Teacher API registration', () => {
  let app: INestApplication;
  const service = { classList: jest.fn().mockResolvedValue([{ id: 1, name: 'Mầm 1' }]), growthList: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [TeacherController], providers: [{ provide: TeacherService, useValue: service }] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate(context: ExecutionContext) {
        context.switchToHttp().getRequest().user = { sub: 7, roles: ['TEACHER'], tenantId: 1 };
        return true;
      } }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });
  afterAll(async () => { await app?.close(); });

  it('registers the teacher module and controller in the application', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule)).toContain(TeacherModule);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TeacherModule)).toContain(TeacherController);
  });

  it('serves the class list at the URL used by the teacher portal', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/teacher/classes').expect(200);
    expect(response.body[0].name).toBe('Mầm 1');
    expect(service.classList).toHaveBeenCalledWith(expect.objectContaining({ sub: 7 }), {});
  });

  it('serves growth data at the URL shown in the error screenshot', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/teacher/growth?classId=&search=&nutritionalStatus=').expect(200);
    expect(response.body).toEqual({ items: [], total: 0 });
  });
});
