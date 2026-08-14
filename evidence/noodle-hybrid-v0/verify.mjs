#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const here = path.dirname(new URL(import.meta.url).pathname);
const contractPath = path.join(here, 'style-contract.json');
const corpusPath = path.join(here, 'training-corpus.sample.jsonl');

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const records = fs.readFileSync(corpusPath, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`invalid JSONL line ${index + 1}: ${error.message}`); }
  });

const errors = [];
const required = new Set(contract.trainingRecordRequiredFields || []);
const allowedViews = new Set([...contract.canonicalViews, 'first_person']);
const allowedJudgments = new Set(contract.trainingPromotion.allowedJudgments);
const ids = new Set();

for (const record of records) {
  for (const field of required) {
    if (!(field in record)) errors.push(`${record.id || '<missing-id>'}: missing ${field}`);
  }
  if (ids.has(record.id)) errors.push(`${record.id}: duplicate id`);
  ids.add(record.id);
  if (!allowedViews.has(record.view)) errors.push(`${record.id}: unrecognized view ${record.view}`);
  if (!allowedJudgments.has(record.judgment)) errors.push(`${record.id}: bad judgment ${record.judgment}`);
  if (!Number.isInteger(record.seed)) errors.push(`${record.id}: seed must be an integer`);
  if (!record.force || typeof record.force.x !== 'number' || typeof record.force.y !== 'number') {
    errors.push(`${record.id}: force must have numeric x/y`);
  }
  if (!Array.isArray(record.materials) || record.materials.length === 0) {
    errors.push(`${record.id}: at least one material required`);
  }
  if (record.lineage === 'negative_fixture' && record.judgment !== 'REJECT') {
    errors.push(`${record.id}: negative fixtures must be REJECT`);
  }
  if (record.judgment === 'KEEP' && record.derivedRaster === 'PENDING_EXPORT') {
    errors.push(`${record.id}: KEEP cannot reference an unexported raster`);
  }
}

const rejectedLabels = new Set(records.filter(r => r.judgment === 'REJECT').flatMap(r => r.labels || []));
for (const record of records.filter(r => r.judgment !== 'REJECT')) {
  for (const label of record.labels || []) {
    if (rejectedLabels.has(label)) errors.push(`${record.id}: positive/pending record reuses rejected label ${label}`);
  }
}

if (contract.status.trainingEligible) {
  if (!contract.trainingPromotion.requiresUserKeep) errors.push('trainingEligible requires user keep policy');
  if (records.some(r => r.judgment === 'PENDING')) errors.push('trainingEligible cannot coexist with PENDING sample records');
}

if (errors.length) {
  console.error('NOODLE HYBRID VERIFY: FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`NOODLE HYBRID VERIFY: PASS (${records.length} records)`);
console.log(`status: prototyped=${contract.status.prototyped} tested=${contract.status.tested} trainingEligible=${contract.status.trainingEligible}`);
