export type Role = 'Support' | 'Admin'
export type Customer = { id: string; name: string; email: string; company: string; accountStatus: 'Active' | 'Inactive'; joinedAt: string }
export type Subscription = { id: string; customerId: string; plan: string; price: number; status: 'Active' | 'Past due' | 'Canceled'; nextRenewal: string }
export type Transaction = { id: string; customerId: string; subscriptionId: string; amount: number; status: 'Paid' | 'Failed' | 'Refunded'; method: string; date: string; failure?: string; refundedAt?: string; refundedAmount?: number; reason?: string; explanation?: string; role?: Role }
export type Activity = { id: string; time: string; role: Role; action: string; transactionId: string; amount: number; reason: string }
export type Data = { customers: Customer[]; subscriptions: Subscription[]; transactions: Transaction[]; activities: Activity[] }

const customers: Customer[] = [
  { id: 'cus_001', name: 'Olivia Martin', email: 'olivia@northstar.example', company: 'Northstar Studio', accountStatus: 'Active', joinedAt: '2025-01-12T10:00:00Z' },
  { id: 'cus_002', name: 'James Wilson', email: 'james@atlas.example', company: 'Atlas Works', accountStatus: 'Active', joinedAt: '2025-03-21T10:00:00Z' },
  { id: 'cus_003', name: 'Sophia Chen', email: 'sophia@fieldnote.example', company: 'Fieldnote', accountStatus: 'Active', joinedAt: '2025-05-03T10:00:00Z' },
  { id: 'cus_004', name: 'Noah Williams', email: 'noah@haven.example', company: 'Haven Co.', accountStatus: 'Inactive', joinedAt: '2024-11-17T10:00:00Z' },
  { id: 'cus_005', name: 'Amelia Brown', email: 'amelia@form.example', company: 'Form & Co.', accountStatus: 'Active', joinedAt: '2025-08-08T10:00:00Z' },
]
const subscriptions: Subscription[] = customers.map((c, i) => ({ id: `sub_00${i + 1}`, customerId: c.id, plan: ['Studio', 'Scale', 'Starter', 'Studio', 'Scale'][i], price: [4900, 9900, 1900, 4900, 9900][i], status: (['Active', 'Past due', 'Active', 'Canceled', 'Active'] as const)[i], nextRenewal: `2026-12-${String(12 + i).padStart(2, '0')}T00:00:00Z` }))
const transactions: Transaction[] = [
  { id: 'txn_1001', customerId: 'cus_001', subscriptionId: 'sub_001', amount: 4900, status: 'Paid', method: 'Visa •••• 4242', date: '2026-11-10T09:22:00Z' },
  { id: 'txn_1002', customerId: 'cus_002', subscriptionId: 'sub_002', amount: 9900, status: 'Failed', method: 'Mastercard •••• 4444', date: '2026-11-09T11:15:00Z', failure: 'insufficient_funds' },
  { id: 'txn_1003', customerId: 'cus_003', subscriptionId: 'sub_003', amount: 1900, status: 'Paid', method: 'Visa •••• 1881', date: '2026-11-07T14:00:00Z' },
  { id: 'txn_1004', customerId: 'cus_005', subscriptionId: 'sub_005', amount: 9900, status: 'Paid', method: 'Amex •••• 0005', date: '2026-11-04T08:12:00Z' },
  { id: 'txn_1005', customerId: 'cus_001', subscriptionId: 'sub_001', amount: 4900, status: 'Failed', method: 'Visa •••• 4242', date: '2026-10-12T09:22:00Z', failure: 'expired_card' },
  { id: 'txn_1006', customerId: 'cus_004', subscriptionId: 'sub_004', amount: 4900, status: 'Failed', method: 'Visa •••• 1111', date: '2026-09-17T10:10:00Z', failure: 'payment_declined' },
]
const seed: Data = { customers, subscriptions, transactions, activities: [] }
const stores = ['customers', 'subscriptions', 'transactions', 'activities'] as const
let dbPromise: Promise<IDBDatabase> | undefined

function database(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('subdesk-demo', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const store of stores) db.createObjectStore(store, { keyPath: 'id' })
      for (const store of stores) for (const item of seed[store]) request.transaction!.objectStore(store).put(item)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}
function completed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error || new Error('Operation failed')); tx.onerror = () => reject(tx.error || new Error('Operation failed')) })
}
export async function getData(): Promise<Data> {
  const db = await database()
  const tx = db.transaction(stores, 'readonly')
  const result = {} as Data
  for (const store of stores) {
    const request = tx.objectStore(store).getAll()
    request.onsuccess = () => { Object.assign(result, { [store]: request.result }) }
  }
  await completed(tx)
  return result
}
export async function refund(id: string, role: Role, reason: string, explanation: string): Promise<void> {
  if (role !== 'Admin') throw new Error('Only an admin can issue a refund.')
  if (!['QA refund', 'Other'].includes(reason) || (reason === 'Other' && !explanation.trim())) throw new Error('Select a reason and provide an explanation for Other.')
  const db = await database()
  const tx = db.transaction(['transactions', 'activities'], 'readwrite')
  const transactionStore = tx.objectStore('transactions')
  const request = transactionStore.get(id)
  let validationError = ''
  request.onsuccess = () => {
    const payment = request.result as Transaction | undefined
    if (!payment || payment.status !== 'Paid') { validationError = 'This payment is no longer eligible for a refund.'; tx.abort(); return }
    const time = new Date().toISOString()
    transactionStore.put({ ...payment, status: 'Refunded', refundedAt: time, refundedAmount: payment.amount, reason, explanation: reason === 'Other' ? explanation.trim() : '', role })
    tx.objectStore('activities').add({ id: crypto.randomUUID(), time, role, action: 'Test refund', transactionId: id, amount: payment.amount, reason: reason === 'Other' ? `${reason}: ${explanation.trim()}` : reason } satisfies Activity)
  }
  try { await completed(tx) } catch (error) { throw new Error(validationError || (error instanceof Error ? error.message : 'Refund failed.'), { cause: error }) }
}
export async function resetDemo(): Promise<void> {
  const db = await database()
  const tx = db.transaction(stores, 'readwrite')
  for (const store of stores) { const objectStore = tx.objectStore(store); objectStore.clear(); for (const item of seed[store]) objectStore.put(item) }
  await completed(tx)
}
