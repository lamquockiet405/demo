import { Repository } from 'typeorm';

/** Serialize related writers across processes and bind all repositories to one transaction. */
export function SerializedWrite(scope: string, repositoryKey: string): MethodDecorator {
  return (_target, _property, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    descriptor.value = async function (...args: unknown[]) {
      const owner = this as Record<string, any>;
      const repository: Repository<any> = owner[repositoryKey];
      if (!repository?.manager?.transaction) {
        return original.apply(this, args);
      }
      return repository.manager.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [scope]);
        const context = Object.assign(Object.create(Object.getPrototypeOf(owner)), owner);
        for (const [key, value] of Object.entries(owner)) {
          if (value instanceof Repository) context[key] = manager.getRepository(value.target);
        }
        return original.apply(context, args);
      });
    };
  };
}
