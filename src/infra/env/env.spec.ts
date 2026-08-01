import { envValidationSchema } from './env';

const validate = (env: Record<string, unknown>) => envValidationSchema.validate(env);

describe('envValidationSchema', () => {
  it('applies defaults to an empty environment', () => {
    const { error, value } = validate({});
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      MONGODB_URI: 'mongodb://localhost:27017/vehicles',
      NHTSA_CONCURRENCY: 10,
    });
  });

  it.each([
    'mongodb://localhost:27017/vehicles',
    'mongodb://h1:27017,h2:27017,h3:27017/vehicles?replicaSet=rs0',
    'mongodb+srv://user:pw@cluster.example.net/vehicles?retryWrites=true',
  ])('accepts %s', (MONGODB_URI) => {
    expect(validate({ MONGODB_URI }).error).toBeUndefined();
  });

  it('rejects a non-mongodb connection string', () => {
    expect(validate({ MONGODB_URI: 'postgres://localhost:5432/vehicles' }).error).toBeDefined();
  });

  it.each([
    ['NODE_ENV', 'staging'],
    ['LOG_LEVEL', 'verbose'],
    ['PORT', 'not-a-port'],
    ['NHTSA_CONCURRENCY', 0],
    ['NHTSA_CONCURRENCY', 51],
    ['INGEST_MAKES_LIMIT', -1],
  ])('rejects an invalid %s', (key, value) => {
    expect(validate({ [key]: value }).error).toBeDefined();
  });
});
