import { Repository } from 'typeorm';
import { SerializedWrite } from '../../../src/common/utils/serialized-write';

class Writer {
  constructor(public records: Repository<any>, public images: Repository<any>) {}
  @SerializedWrite('test-domain', 'records')
  async save(fail = false) {
    await this.records.manager.query('write-record');
    await this.images.manager.query('write-image');
    if (fail) throw new Error('failed-image');
    return 'saved';
  }
}

describe('SerializedWrite transaction boundary', () => {
  function setup() {
    const transactional: any = { query: jest.fn().mockResolvedValue([]) };
    transactional.getRepository = (target: any) => new Repository(target, transactional);
    const manager: any = {
      query: jest.fn(),
      transaction: jest.fn(async (work) => work(transactional)),
    };
    const records = new Repository('records', manager);
    const images = new Repository('images', manager);
    return { writer: new Writer(records, images), manager, transactional, records, images };
  }
  it('locks before writing and binds every repository to the transaction', async () => {
    const { writer, transactional, manager } = setup();
    await expect(writer.save()).resolves.toBe('saved');
    expect(transactional.query.mock.calls).toEqual([
      ['SELECT pg_advisory_xact_lock(hashtext($1))', ['test-domain']],
      ['write-record'], ['write-image'],
    ]);
    expect(manager.query).not.toHaveBeenCalled();
  });
  it('propagates failures so TypeORM rolls back the entire operation', async () => {
    const { writer, manager } = setup();
    await expect(writer.save(true)).rejects.toThrow('failed-image');
    expect(manager.transaction).toHaveBeenCalledTimes(1);
  });
  it('does not mutate singleton repositories, even on failure', async () => {
    const { writer, records, images } = setup();
    await writer.save(true).catch(() => undefined);
    expect(writer.records).toBe(records);
    expect(writer.images).toBe(images);
  });
});
