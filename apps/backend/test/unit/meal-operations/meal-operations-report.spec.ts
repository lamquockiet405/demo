import 'reflect-metadata';
import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { TenantResolverMiddleware } from '../../../src/common/middleware/tenant-resolver.middleware';
import { DailyMealAttendance } from '../../../src/modules/attendance/entities/daily-meal-attendance.entity';
import { MealCoordinationNote } from '../../../src/modules/attendance/entities/meal-coordination-note.entity';
import { AuditLogEntity } from '../../../src/modules/audit-logs/entities/audit-log.entity';
import { AuditLogsService } from '../../../src/modules/audit-logs/services/audit-logs.service';
import { User } from '../../../src/modules/auth/entities/user.entity';
import { Child } from '../../../src/modules/children/entities/child.entity';
import { ChildAllergy } from '../../../src/modules/children/entities/child-allergy.entity';
import { ClassEntity } from '../../../src/modules/classes/entities/class.entity';
import { InspectionRecord } from '../../../src/modules/inspections/entities/inspection-record.entity';
import { InspectionSampleItem } from '../../../src/modules/inspections/entities/inspection-sample-item.entity';
import { MealOperationsModule } from '../../../src/modules/meal-operations/meal-operations.module';
import { DailyMealPortion } from '../../../src/modules/meal-portions/entities/daily-meal-portion.entity';

describe('Meal operations report route', () => {
  let app: INestApplication;
  const repository = () => ({
    find: jest.fn().mockResolvedValue([]),
    manager: { query: jest.fn().mockResolvedValue([{ name: 'Test school' }]) },
  });
  const entities = [
    DailyMealAttendance, DailyMealPortion, InspectionRecord, InspectionSampleItem,
    MealCoordinationNote, Child, ClassEntity, ChildAllergy, User, AuditLogEntity,
  ];
  const repositories = new Map(entities.map((entity) => [entity, repository()]));

  beforeAll(async () => {
    const builder = Test.createTestingModule({ imports: [MealOperationsModule] })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          req.user = { id: 1, roles: [req.headers['x-test-role'] || 'PRINCIPAL'] };
          return true;
        },
      })
      .overrideProvider(AuditLogsService)
      .useValue({ logAction: jest.fn().mockResolvedValue(undefined) });

    for (const [entity, repo] of repositories) {
      builder.overrideProvider(getRepositoryToken(entity)).useValue(repo);
    }
    const module = await builder.compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(new TenantResolverMiddleware().use);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => { await app?.close(); });

  it('registers the report module in the application', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule))
      .toContain(MealOperationsModule);
  });

  it('serves the selected date for a principal even when no meals are recorded', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/meal-operations/report?date=2026-11-16')
      .set('x-tenant-id', '2')
      .expect(200);

    expect(response.body).toMatchObject({
      date: '2026-11-16',
      schoolName: 'Test school',
      reconciliation: {
        totalEnrolledStudents: 0,
        actualLunchCount: 0,
        actualSnackCount: 0,
        classBreakdown: [],
      },
      foodSafetyInspection: {
        sampleRetention24h: { status: 'NO_DATA', samples: [] },
      },
    });
    expect(repositories.get(DailyMealAttendance).find).toHaveBeenCalledWith({
      where: { date: '2026-11-16' }, relations: ['student'],
    });
    expect(repositories.get(Child).manager.query).toHaveBeenCalledWith(
      'SELECT name FROM schools WHERE id=$1', [2],
    );
  });

  it('keeps the report unavailable to parents', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/meal-operations/report?date=2026-11-16')
      .set('x-test-role', 'PARENT')
      .expect(403);
    expect(repositories.get(DailyMealAttendance).find).not.toHaveBeenCalled();
  });
});
