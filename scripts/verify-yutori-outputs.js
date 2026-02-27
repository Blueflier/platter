/**
 * Verifies that Yutori research layer produces outputs in the shape required
 * for the pipeline downstream (business object: email, style, description).
 * Run: node scripts/verify-yutori-outputs.js
 * Requires: YUTORI_API_KEY in .env. May take up to 10 min for task to complete.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const yutori = require('../services/yutori');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (!process.env.YUTORI_API_KEY) {
    console.error('YUTORI_API_KEY not set.');
    process.exit(1);
  }

  console.log('Yutori layer verification (one task; may take up to 10 min)\n');

  console.log('1. createTask(businessName, address)');
  const { task_id } = await yutori.createTask('Luxe Nails', '123 Market St, San Francisco');
  assert(task_id, 'task_id returned');
  console.log('   task_id:', task_id.slice(0, 20) + '...\n');

  console.log('2. pollTask(task_id) → wait for completion');
  const result = await yutori.pollTask(task_id);
  console.log('   completed.\n');

  console.log('3. Output shape required for pipeline downstream');
  assert(result !== null && typeof result === 'object', 'result is object');
  assert('email' in result, 'result has email');
  assert('style' in result, 'result has style');
  assert('description' in result, 'result has description');

  assert(result.email === null || typeof result.email === 'string', 'email is null or string');
  assert(result.style === null || typeof result.style === 'string', 'style is null or string');
  assert(typeof result.description === 'string', 'description is string');

  console.log('   email:    ', result.email === null ? '(null)' : result.email);
  console.log('   style:    ', result.style === null ? '(null)' : result.style);
  console.log('   description:', result.description ? result.description.slice(0, 80) + (result.description.length > 80 ? '...' : '') : '(empty)');

  console.log('\n4. Pipeline usage check');
  const email = result.email || null;
  const style = result.style || null;
  const description = result.description || '';
  const business = {
    email,
    style,
    description
  };
  assert(business.description !== undefined, 'description can be used in business object');
  assert(business.email === null || typeof business.email === 'string', 'email fits business object');
  assert(business.style === null || typeof business.style === 'string', 'style fits business object');
  console.log('   business.{ email, style, description } ready for pipeline — OK');

  console.log('\n--- Yutori layer outputs verified: shape is correct for pipeline downstream ---');
}

main().catch(err => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});
