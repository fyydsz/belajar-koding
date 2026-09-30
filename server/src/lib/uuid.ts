import { v7 as uuidv7, validate, version } from 'uuid';

/**
 * UUID v7 generator menggunakan library resmi 'uuid'
 */
export { uuidv7 };

/**
 * Validasi apakah sebuah string merupakan UUID v7 yang valid
 */
export function isValidUuidV7(id: string): boolean {
  return validate(id) && version(id) === 7;
}
