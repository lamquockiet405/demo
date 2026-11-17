import { Test } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ChildrenController } from '../../../src/modules/children/controllers/children.controller';
import { ChildrenService } from '../../../src/modules/children/services/children.service';
import { AllergenRulesController } from '../../../src/modules/nutrition-engine/controllers/allergen-rules.controller';
import { AllergenRulesService } from '../../../src/modules/nutrition-engine/services/allergen-rules.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';

describe('Nutritionist allergy read-only access', () => {
  let app: INestApplication;
  const children = { findAll: jest.fn().mockResolvedValue({ items: [] }), declareAllergy: jest.fn(), updateAllergy: jest.fn(), deleteAllergy: jest.fn() };
  const allergens = { findAll: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), remove: jest.fn(), restore: jest.fn() };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ controllers: [ChildrenController, AllergenRulesController], providers: [
      { provide: ChildrenService, useValue: children }, { provide: AllergenRulesService, useValue: allergens },
    ] }).overrideGuard(JwtAuthGuard).useValue({ canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 7, roles: [req.headers['x-test-role'] || 'NUTRITIONIST'] };
      return true;
    } }).compile();
    app = fixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });
  afterAll(async () => { await app?.close(); });
  it('allows viewing children and the allergen catalog', async () => {
    await request(app.getHttpServer()).get('/api/v1/children').expect(200);
    await request(app.getHttpServer()).get('/api/v1/allergens').expect(200);
  });
  it.each([
    ['post', '/children/1/allergies'], ['put', '/children/allergies/1'], ['delete', '/children/allergies/1'],
    ['post', '/allergens'], ['put', '/allergens/1'], ['delete', '/allergens/1'], ['patch', '/allergens/1/status'], ['patch', '/allergens/1/restore'],
  ])('denies nutritionist %s %s', async (method, url) => {
    await (request(app.getHttpServer()) as any)[method]('/api/v1' + url).send({}).expect(403);
    for (const fn of [children.declareAllergy, children.updateAllergy, children.deleteAllergy, allergens.create, allergens.update, allergens.remove, allergens.restore]) expect(fn).not.toHaveBeenCalled();
  });
  it('preserves school manager permission to create catalog records', async () => {
    await request(app.getHttpServer()).post('/api/v1/allergens').set('x-test-role', 'SCHOOL_MANAGER').send({}).expect(201);
    expect(allergens.create).toHaveBeenCalled();
  });
});
