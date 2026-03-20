import checkServices from './check-services';
import resetDb from './reset-db';

export default async function globalSetup() {
  await checkServices();
  await resetDb();
}
