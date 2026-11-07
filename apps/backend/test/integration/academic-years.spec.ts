import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';
import request = require('supertest');
import { AcademicYearsModule } from '../../src/modules/academic-years/academic-years.module';
import { AcademicYearsService } from '../../src/modules/academic-years/academic-years.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { ClassEntity } from '../../src/modules/classes/entities/class.entity';
import { User } from '../../src/modules/auth/entities/user.entity';
import { Role } from '../../src/modules/auth/entities/role.entity';
import { ClassesService } from '../../src/modules/classes/classes.service';
import { activeAcademicYear } from '../../src/modules/classes/active-academic-year';

describe('Principal academic years (HTTP + isolated PostgreSQL schema)', () => {
  const root = resolve(__dirname, '../../../..');
  const env = parse(readFileSync(resolve(root, '.docker-test/test.env')));
  const schema = `academic_year_qa_${randomBytes(8).toString('hex')}`;
  const migration = readFileSync(resolve(root, 'database/migrations/20261107-academic-years.sql'), 'utf8');
  let db: DataSource;
  let app: INestApplication;
  let service: AcademicYearsService;
  let sourceId: number;
  const year = (name: string, sourceYearId?: number) => ({ name, startDate: '2026-09-01', endDate: '2027-08-31', sourceYearId });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    if (!(env.TEST_POSTGRES_DB || 'kidmeal_test').startsWith('kidmeal_test')) throw new Error('Only the local test database is supported');
    db = await new DataSource({ type: 'postgres', host: '127.0.0.1', port: 55432,
      username: 'kidmeal_test', password: env.TEST_POSTGRES_PASSWORD,
      database: env.TEST_POSTGRES_DB || 'kidmeal_test', schema,
      extra: { options: `-c search_path=${schema},pg_catalog` }, entities: [ClassEntity, User, Role], synchronize: false }).initialize();
    await db.query(`CREATE SCHEMA ${schema}`);
    const base = readFileSync(resolve(root, 'database/schema.sql'), 'utf8');
    for (const name of ['users', 'roles', 'user_roles', 'schools', 'classes', 'students', 'student_parents']) {
      const match = base.match(new RegExp(`CREATE TABLE ${name} \\([\\s\\S]*?\\n\\);`));
      if (!match) throw new Error(`Missing table ${name}`);
      await db.query(match[0]);
    }
    await db.query(`INSERT INTO schools(name) VALUES ('QA school'),('Other school');
      INSERT INTO users(email,password_hash,full_name) VALUES ('teacher@test.invalid','disabled','QA teacher'),('parent@test.invalid','disabled','QA parent');
      INSERT INTO roles(code,name) VALUES ('TEACHER','Teacher'); INSERT INTO user_roles VALUES (1,1);
      INSERT INTO classes(school_id,name,age_group,school_year,homeroom_teacher_id) VALUES (1,'QA class','MAU_GIAO','2025-2026',1);
      INSERT INTO students(class_id,student_code,full_name,date_of_birth,gender) VALUES
        (1,'QA-ONE','QA Student One','2022-01-01','MALE'),(1,'QA-TWO','QA Student Two','2022-02-01','FEMALE');
      INSERT INTO student_parents(student_id,parent_id,relationship,is_primary) VALUES (1,2,'MOTHER',true)`);
    await db.query(migration);
    // DataSource is global in the running application; provide the same boundary here.
    const { Module, Global } = await import('@nestjs/common');
    @Global() @Module({ providers: [{ provide: DataSource, useValue: db }], exports: [DataSource] })
    class TestDatabaseModule {}
    const testing = await Test.createTestingModule({ imports: [TestDatabaseModule, AcademicYearsModule] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest();
        req.user = { sub: 1, roles: [req.headers['x-test-role'] || 'PRINCIPAL'], tenantId: '1' };
        req.tenantId = Number(req.headers['x-tenant-id'] || 1); return true;
      } }).compile();
    app = testing.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    service = app.get(AcademicYearsService);
    sourceId = Number((await service.list(1))[0].id);
  });

  afterAll(async () => {
    await app?.close();
    if (db?.isInitialized) {
      if (!/^academic_year_qa_[a-f0-9]{16}$/.test(schema)) throw new Error('Unexpected test schema');
      await db.query(`DROP SCHEMA ${schema} CASCADE`);
      await db.destroy();
    }
  });

  it('preserves existing classes and contacts; migration can be reapplied', async () => {
    const before = await service.detail(sourceId, 1);
    expect(before.status).toBe('ACTIVE'); expect(before.classes).toHaveLength(1);
    expect(before.enrollments).toHaveLength(2);
    expect(before.enrollments.find(e => e.studentSnapshot.studentCode === 'QA-ONE').parentContacts[0].fullName).toBe('QA parent');
    await db.query(migration);
    expect(await service.detail(sourceId, 1)).toEqual(before);
  });

  it.each(['TEACHER','PARENT','NUTRITIONIST','KITCHEN_STAFF'])('denies %s read and write access', async role => {
    await http().get('/academic-years').set('x-test-role', role).expect(403);
    await http().post('/academic-years').set('x-test-role', role).send(year('Denied')).expect(403);
  });

  it('rejects tenant spoofing and cross-school inheritance', async () => {
    await http().get('/academic-years').set('x-tenant-id','2').expect(403);
    await expect(service.detail(sourceId, 2)).rejects.toMatchObject({ status: 404 });
    await expect(service.create(year('Other copy', sourceId), 2)).rejects.toMatchObject({ status: 404 });
  });

  it('validates dates and prevents duplicate year names', async () => {
    await http().post('/academic-years').send({ ...year('Invalid'), endDate: '2026-08-31' }).expect(400);
    await http().post('/academic-years').send({ ...year('Invalid'), startDate: '2026-02-30' }).expect(400);
    await http().post('/academic-years').send(year('Unique')).expect(201);
    await http().post('/academic-years').send(year('Unique')).expect(409);
  });

  it('inherits classes and identities while keeping source profiles independent', async () => {
    const source = await service.detail(sourceId, 1);
    const count = async () => (await db.query('SELECT (SELECT count(*)::int FROM students) AS students,(SELECT count(*)::int FROM users) AS users'))[0];
    const before = await count();
    const created = await http().post('/academic-years').send(year('Inherited', sourceId)).expect(201);
    const id = Number(created.body.id), copy = await service.detail(id, 1);
    expect(copy.status).toBe('DRAFT'); expect(copy.classes).toHaveLength(1); expect(copy.enrollments).toHaveLength(2);
    expect(await count()).toEqual(before);
    await http().patch(`/academic-years/${id}/enrollments/${copy.enrollments[0].id}`).send({ fullName: 'Changed in new year', parentContacts: [] }).expect(200);
    expect(await service.detail(sourceId, 1)).toEqual(source);
    await http().patch(`/academic-years/${id}`).send({ name: 'Renamed', notes: 'School year notes' }).expect(200);
    expect((await db.query('SELECT school_year FROM classes WHERE academic_year_id=$1',[id]))[0].school_year).toBe('Renamed');
  });

  it('handles class assignment, student creation, movement and contact validation', async () => {
    const created = await service.create(year('Student editing'),1), id = Number(created.id);
    const cls = await service.saveClass(id,null,{name:'New class',ageGroup:'NHA_TRE',homeroomTeacherId:1},1);
    const second = await service.saveClass(id,null,{name:'Second class',ageGroup:'MAU_GIAO'},1);
    await service.saveClass(id,Number(cls.id),{homeroomTeacherId:null},1);
    expect((await service.detail(id,1)).classes[0].homeroomTeacherId).toBeNull();
    const response = await http().post(`/academic-years/${id}/students`).send({ classId:Number(cls.id), fullName:'New student', dateOfBirth:'2023-01-01', gender:'MALE',
      parentContacts:[{fullName:'Contact',phone:'0900000000',relationship:'GUARDIAN',isPrimary:true}] }).expect(201);
    const enrollmentId=response.body.id;
    await http().patch(`/academic-years/${id}/classes/${cls.id}`).send({status:'INACTIVE'}).expect(400);
    await http().patch(`/academic-years/${id}/enrollments/${enrollmentId}`).send({classId:Number(second.id)}).expect(200);
    expect((await service.detail(id,1)).enrollments[0].classId).toBe(second.id);
    await http().post(`/academic-years/${id}/classes`).send({name:'Second class',ageGroup:'MAU_GIAO'}).expect(409);
    await http().post(`/academic-years/${id}/students`).send({classId:Number(second.id),fullName:'Invalid',dateOfBirth:'2023-01-01',gender:'MALE',
      parentContacts:[1,2].map(() => ({fullName:'Duplicate primary',phone:'',relationship:'MOTHER',isPrimary:true}))}).expect(400);
    const candidates=await service.availableStudents(id,1);
    expect(candidates.some(s=>s.studentCode==='QA-ONE')).toBe(true);
    await service.addEnrollment(id,{studentId:1,classId:Number(second.id)},1);
    expect((await service.availableStudents(id,1)).some(s=>s.studentCode==='QA-ONE')).toBe(false);
    await expect(service.addEnrollment(id,{studentId:1,classId:Number(second.id)},1)).rejects.toMatchObject({status:409});
  });

  it('excludes withdrawn students from inheritance', async () => {
    const copy=await service.create(year('Withdrawal',sourceId),1), id=Number(copy.id);
    const detail=await service.detail(id,1);
    await service.updateEnrollment(id,Number(detail.enrollments[0].id),{status:'LEFT'},1);
    const next=await service.create({name:'Following year',startDate:'2027-09-01',endDate:'2028-08-31',sourceYearId:id},1);
    expect((await service.detail(Number(next.id),1)).enrollments).toHaveLength(1);
  });

  it('keeps draft classes out of operational lists and permits the same class name in different years', async () => {
    const repository=db.getRepository(ClassEntity);
    const classes=new ClassesService(repository,{find:async()=>[]} as any);
    expect((await classes.findAll({})).map(c=>c.schoolYear)).toEqual(['2025-2026']);
    expect(await repository.find({where:{academicYearId:activeAcademicYear()}})).toHaveLength(1);
    await expect(classes.create({name:'QA class',ageGroup:'MAU_GIAO',schoolYear:'Unique'})).resolves.toMatchObject({schoolYear:'Unique'});
    expect(await classes.findAll({})).toHaveLength(1);
    await expect(classes.create({name:'QA class',ageGroup:'MAU_GIAO',schoolYear:'Unique'})).rejects.toMatchObject({status:409});
    expect(await classes.findAll({schoolYear:'Unique'})).toHaveLength(1);
  });

  it('enforces one active year and rolls over students without changing historical snapshots', async () => {
    const copy=await service.create(year('Rollover',sourceId),1), id=Number(copy.id);
    await expect(service.activate(id,1)).rejects.toMatchObject({status:409});
    const old=await service.detail(sourceId,1);
    await service.complete(sourceId,1);
    await service.activate(id,1);
    expect((await service.detail(id,1)).status).toBe('ACTIVE');
    const rows=await db.query('SELECT s.class_id,c.academic_year_id FROM students s JOIN classes c ON c.id=s.class_id WHERE s.student_code LIKE $1',['QA-%']);
    expect(rows).toHaveLength(2); expect(rows.every(r=>Number(r.academic_year_id)===id)).toBe(true);
    expect((await service.detail(sourceId,1)).enrollments).toEqual(old.enrollments);
    await db.query("UPDATE students SET full_name='Updated through existing student screen' WHERE student_code='QA-ONE'");
    expect((await service.detail(id,1)).enrollments.some(e=>e.studentSnapshot.fullName==='Updated through existing student screen')).toBe(true);
    expect((await service.detail(sourceId,1)).enrollments).toEqual(old.enrollments);
    await expect(service.activate(id,1)).rejects.toMatchObject({status:400});
  });
});
