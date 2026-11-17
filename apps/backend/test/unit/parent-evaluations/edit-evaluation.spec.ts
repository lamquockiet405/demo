import { ParentEvaluationService } from '../../../src/modules/parent-evaluations/services/parent-evaluation.service';

describe('One parent evaluation per child, day and meal', () => {
  function setup() {
    const rows: any[] = [];
    let permitted = true;
    const manager: any = {
      query: jest.fn(async (sql: string) => sql.startsWith('SELECT pg_advisory') ? [] : permitted ? [{ student_id: 3 }] : []),
      getRepository: () => repo,
      transaction: async (work: any) => work(manager),
    };
    const repo: any = {
      manager,
      findOne: jest.fn(async ({ where }: any) => rows.filter(row => Object.entries(where).every(([key, value]) => row[key] === value)).sort((a, b) => b.id - a.id)[0] || null),
      create: (value: any) => ({ ...value }),
      save: jest.fn(async (value: any) => {
        if (!value.id) { value.id = rows.length + 1; value.createdAt = new Date(); rows.push(value); }
        value.updatedAt = new Date(); return value;
      }),
    };
    const service = new ParentEvaluationService(repo, {} as any, {} as any, {} as any);
    return { service, rows, repo, manager, deny: () => { permitted = false; } };
  }
  const payload = { childId: '3', feedbackDate: '2026-11-05', mealType: 'LUNCH', evaluationType: 'QUICK_EVALUATION', rating: 4, content: 'Original', attributes: { taste: 'Mild', tags: ['Tag'] }, isDrafting: false };

  it('rejects a second create for the same meal instead of silently creating another row', async () => {
    const { service, rows, manager } = setup();
    await service.submitEvaluation(payload, 13);
    await expect(service.submitEvaluation(payload, 13)).rejects.toThrow('Bữa ăn này đã có đánh giá');
    expect(rows).toHaveLength(1);
    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', ['meal-evaluation:3:2026-11-05:LUNCH']);
  });

  it('updates the original id and preserves its creation timestamp and school replies', async () => {
    const { service, rows } = setup();
    await service.submitEvaluation(payload, 13);
    const createdAt = rows[0].createdAt;
    rows[0].replies = [{ content: 'School reply', repliedAt: new Date() }];
    const result = await service.updateEvaluation(1, { ...payload, rating: 3, content: 'Edited', attributes: { taste: 'Less salt' } }, 13);
    expect(rows).toHaveLength(1);
    expect(result.data.id).toBe('1');
    expect(result.data.content).toBe('Edited');
    expect(result.data.attributes.taste).toBe('Less salt');
    expect(rows[0].createdAt).toBe(createdAt);
    expect(rows[0].replies[0].content).toBe('School reply');
  });

  it('keeps a saved draft and its eventual submission in a single row', async () => {
    const { service, rows } = setup();
    await service.submitEvaluation({ ...payload, isDrafting: true }, 13);
    await service.updateEvaluation(1, { ...payload, isDrafting: true, content: 'Draft edit' }, 13);
    expect(rows).toHaveLength(1);
    const result = await service.updateEvaluation(1, payload, 13);
    expect(result.data.isDrafting).toBe(false);
    expect(rows).toHaveLength(1);
  });

  it('does not downgrade a submitted evaluation to a draft', async () => {
    const { service } = setup(); await service.submitEvaluation(payload, 13);
    await expect(service.updateEvaluation(1, { ...payload, isDrafting: true }, 13)).rejects.toThrow('không thể chuyển thành bản nháp');
  });

  it('allows distinct days and meals and keeps school proposals independent', async () => {
    const { service, rows } = setup();
    await service.submitEvaluation(payload, 13);
    await service.submitEvaluation({ ...payload, feedbackDate: '2026-11-06' }, 13);
    await service.submitEvaluation({ ...payload, mealType: 'BREAKFAST' }, 13);
    await service.submitEvaluation({ ...payload, evaluationType: 'SCHOOL_PROPOSAL' }, 13);
    await service.submitEvaluation({ ...payload, evaluationType: 'SCHOOL_PROPOSAL' }, 13);
    expect(rows).toHaveLength(5);
  });

  it('rejects another parent editing an unlinked child', async () => {
    const app = setup(); await app.service.submitEvaluation(payload, 13); app.deny();
    await expect(app.service.updateEvaluation(1, payload, 99)).rejects.toThrow('không có quyền');
    expect(app.rows[0].comment).toBe('Original');
  });

  it.each([{ childId: '4' }, { feedbackDate: '2026-11-06' }, { mealType: 'BREAKFAST' }])('rejects moving an existing evaluation to a different target %j', async change => {
    const { service } = setup(); await service.submitEvaluation(payload, 13);
    await expect(service.updateEvaluation(1, { ...payload, ...change }, 13)).rejects.toThrow('Không thể đổi');
  });

  it('rejects impossible dates and ratings outside the star range', async () => {
    const { service } = setup();
    await expect(service.submitEvaluation({ ...payload, feedbackDate: '2026-02-30' }, 13)).rejects.toThrow('Ngày đánh giá');
    await expect(service.submitEvaluation({ ...payload, rating: 6 }, 13)).rejects.toThrow('Điểm đánh giá');
  });
});
