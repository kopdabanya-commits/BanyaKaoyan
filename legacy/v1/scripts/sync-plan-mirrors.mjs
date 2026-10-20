import fs from 'node:fs';

const args = process.argv.slice(2);
const write = args.includes('--write');
const check = args.includes('--check') || !write;
const subject = args.find((arg) => !arg.startsWith('--')) || 'both';
if (!['english', 'politics', 'both'].includes(subject) || (write && args.includes('--check'))) {
  console.error('Usage: node scripts/sync-plan-mirrors.mjs [--check|--write] [english|politics|both]');
  process.exit(2);
}
const plans = [
  ['english', 'plan.json', 'plan-data.js', 'STUDY_PLAN'],
  ['politics', 'politics-plan.json', 'politics-plan-data.js', 'POLITICS_PLAN'],
];
for (const [name, source, mirror, globalName] of plans) {
  if (subject !== 'both' && subject !== name) continue;
  const plan = JSON.parse(fs.readFileSync(source, 'utf8'));
  const expected = `window.${globalName} = ${JSON.stringify(plan)};\n`;
  if (check && fs.readFileSync(mirror, 'utf8') !== expected) {
    console.error(`${mirror} does not match ${source}; run this command with --write ${name}.`);
    process.exitCode = 1;
  }
  if (write) {
    fs.writeFileSync(mirror, expected);
    console.log(`Updated ${mirror} from ${source}.`);
  }
}
if (check && !process.exitCode) console.log('Both requested plan mirrors match their JSON sources.');
