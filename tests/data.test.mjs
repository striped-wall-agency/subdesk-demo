import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getData, refund, resetDemo } from '../src/data.ts'

test('refund rules, concurrency, persistence and reset', async () => {
  await resetDemo()
  const initial = await getData()
  const paid = initial.transactions.find(t => t.status === 'Paid')
  const failed = initial.transactions.find(t => t.status === 'Failed')
  assert.ok(paid && failed)
  await assert.rejects(refund(paid.id, 'Support', 'QA refund', ''))
  await assert.rejects(refund(paid.id, 'Admin', 'Other', ' '))
  await assert.rejects(refund(failed.id, 'Admin', 'QA refund', ''))
  assert.deepEqual(await getData(), initial)

  const outcomes = await Promise.allSettled([
    refund(paid.id, 'Admin', 'Other', 'Duplicate charge'),
    refund(paid.id, 'Admin', 'QA refund', ''),
  ])
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1)
  const after = await getData()
  const updated = after.transactions.find(t => t.id === paid.id)
  assert.equal(updated.status, 'Refunded')
  assert.equal(updated.refundedAmount, paid.amount)
  assert.equal(after.activities.length, 1)
  assert.equal(after.activities[0].transactionId, paid.id)
  assert.deepEqual(after.subscriptions, initial.subscriptions)
  await assert.rejects(refund(paid.id, 'Admin', 'QA refund', ''))
  assert.equal((await getData()).activities.length, 1)
  const otherPaid = after.transactions.find(t => t.status === 'Paid')
  assert.ok(otherPaid)
  const originalUUID = crypto.randomUUID
  crypto.randomUUID = () => after.activities[0].id
  try {
    await assert.rejects(refund(otherPaid.id, 'Admin', 'QA refund', ''))
    assert.deepEqual(await getData(), after)
  } finally {
    crypto.randomUUID = originalUUID
  }
  await resetDemo()
  assert.deepEqual(await getData(), initial)
})
