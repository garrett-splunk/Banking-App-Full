/**
 * Seed demo data for SecureBank platform.
 * Prerequisites: postgres running, schemas migrated (docker compose up).
 * Usage: npm run seed
 */
import pg from 'pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const { Client } = pg;
const DEMO_PASSWORD = 'Demo1234!';
const DB_URL = (db: string) =>
  process.env.DATABASE_URL?.replace(/\/[^/]+$/, `/${db}`) ||
  `postgresql://bank:bank_dev_password_change_me@localhost:5432/${db}`;

function calculateMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1)
  );
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const auth = new Client({ connectionString: DB_URL('auth_db') });
  const user = new Client({ connectionString: DB_URL('user_db') });
  const account = new Client({ connectionString: DB_URL('account_db') });
  const transaction = new Client({ connectionString: DB_URL('transaction_db') });
  const notification = new Client({ connectionString: DB_URL('notification_db') });
  const document = new Client({ connectionString: DB_URL('document_db') });
  const loan = new Client({ connectionString: DB_URL('loan_db') });
  const creditCard = new Client({ connectionString: DB_URL('creditcard_db') });

  await Promise.all([
    auth.connect(),
    user.connect(),
    account.connect(),
    transaction.connect(),
    notification.connect(),
    document.connect(),
    loan.connect(),
    creditCard.connect(),
  ]);

  await auth.query(`
    INSERT INTO "User" (id, email, "passwordHash", role, "mfaEnabled", "createdAt", "updatedAt")
    VALUES
      ($1, 'admin@bank.demo', $4, 'admin', false, NOW(), NOW()),
      ($2, 'alice@bank.demo', $4, 'customer', false, NOW(), NOW()),
      ($3, 'bob@bank.demo', $4, 'customer', false, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET "passwordHash" = $4, role = EXCLUDED.role
  `, [randomUUID(), randomUUID(), randomUUID(), passwordHash]);

  const adminRow = (await auth.query(`SELECT id FROM "User" WHERE email = 'admin@bank.demo'`)).rows[0];
  const aliceRow = (await auth.query(`SELECT id FROM "User" WHERE email = 'alice@bank.demo'`)).rows[0];
  const bobRow = (await auth.query(`SELECT id FROM "User" WHERE email = 'bob@bank.demo'`)).rows[0];

  const profiles = [
    [adminRow.id, 'admin@bank.demo', 'Admin', 'User', 120000],
    [aliceRow.id, 'alice@bank.demo', 'Alice', 'Johnson', 92000],
    [bobRow.id, 'bob@bank.demo', 'Bob', 'Smith', 68000],
  ] as const;

  for (const [userId, email, firstName, lastName, income] of profiles) {
    await user.query(`
      INSERT INTO "UserProfile" (id, "userId", email, "firstName", "lastName", phone, "dateOfBirth", "addressLine1", city, state, "zipCode", "employmentStatus", "annualIncome", "profileComplete", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, '555-0100', '1990-01-15', '123 Main St', 'New York', 'NY', '10001', 'EMPLOYED', $6, true, NOW(), NOW())
      ON CONFLICT ("userId") DO UPDATE SET
        "profileComplete" = true,
        "firstName" = $4,
        "lastName" = $5,
        "annualIncome" = $6
    `, [randomUUID(), userId, email, firstName, lastName, income]);

    await notification.query(`
      INSERT INTO "UserEmail" ("userId", email) VALUES ($1, $2)
      ON CONFLICT ("userId") DO UPDATE SET email = $2
    `, [userId, email]);
  }

  // Verified KYC documents (all demo users — enables loan/CC flows)
  for (const userId of [adminRow.id, aliceRow.id, bobRow.id]) {
    await document.query(`DELETE FROM "Document" WHERE "userId" = $1`, [userId]);
    for (const [type, fileName] of [
      ['GOVERNMENT_ID', 'drivers-license.pdf'],
      ['PROOF_OF_INCOME', 'pay-stub.pdf'],
      ['PROOF_OF_ADDRESS', 'utility-bill.pdf'],
    ] as const) {
      await document.query(`
        INSERT INTO "Document" (id, "userId", type, "fileName", "filePath", status, "uploadedAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, 'VERIFIED', NOW() - interval '7 days', NOW())
      `, [randomUUID(), userId, type, fileName, `/uploads/seed/${userId}/${fileName}`]);
    }
  }

  const adminCheckingId = randomUUID();
  const adminSavingsId = randomUUID();
  const adminLoanAcctId = randomUUID();
  const adminCardAcctId = randomUUID();
  const aliceCheckingId = randomUUID();
  const aliceSavingsId = randomUUID();
  const aliceLoanAcctId = randomUUID();
  const aliceCardAcctId = randomUUID();
  const bobCheckingId = randomUUID();
  const bobSavingsId = randomUUID();

  await account.query(`
    INSERT INTO "Account" (id, "userId", "accountNumber", type, name, balance, currency, status, "createdAt", "updatedAt")
    VALUES
      ($9, $10, '1000000007', 'CHECKING', 'Executive Checking', 45000, 'USD', 'ACTIVE', NOW() - interval '200 days', NOW()),
      ($11, $10, '1000000008', 'SAVINGS', 'Reserve Savings', 75000, 'USD', 'ACTIVE', NOW() - interval '200 days', NOW()),
      ($12, $10, '1000000009', 'LOAN', 'Personal Loan', 0, 'USD', 'ACTIVE', NOW() - interval '90 days', NOW()),
      ($13, $10, '1000000010', 'CREDIT_CARD', 'Platinum Credit Card', 0, 'USD', 'ACTIVE', NOW() - interval '60 days', NOW()),
      ($1, $2, '1000000001', 'CHECKING', 'Primary Checking', 28450.50, 'USD', 'ACTIVE', NOW() - interval '180 days', NOW()),
      ($3, $2, '1000000002', 'SAVINGS', 'High Yield Savings', 52000, 'USD', 'ACTIVE', NOW() - interval '180 days', NOW()),
      ($4, $2, '1000000005', 'LOAN', 'Personal Loan', 0, 'USD', 'ACTIVE', NOW() - interval '60 days', NOW()),
      ($5, $2, '1000000006', 'CREDIT_CARD', 'Rewards Credit Card', 0, 'USD', 'ACTIVE', NOW() - interval '45 days', NOW()),
      ($6, $7, '1000000003', 'CHECKING', 'Primary Checking', 8750.25, 'USD', 'ACTIVE', NOW() - interval '120 days', NOW()),
      ($8, $7, '1000000004', 'SAVINGS', 'Emergency Savings', 12500, 'USD', 'ACTIVE', NOW() - interval '90 days', NOW())
    ON CONFLICT ("accountNumber") DO UPDATE SET
      balance = EXCLUDED.balance,
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      "updatedAt" = NOW()
  `, [
    aliceCheckingId,
    aliceRow.id,
    aliceSavingsId,
    aliceLoanAcctId,
    aliceCardAcctId,
    bobCheckingId,
    bobRow.id,
    bobSavingsId,
    adminCheckingId,
    adminRow.id,
    adminSavingsId,
    adminLoanAcctId,
    adminCardAcctId,
  ]);

  const adminChecking = (await account.query(`SELECT id FROM "Account" WHERE "accountNumber" = '1000000007'`)).rows[0];
  const adminSavings = (await account.query(`SELECT id FROM "Account" WHERE "accountNumber" = '1000000008'`)).rows[0];
  const adminLoanAccount = (await account.query(`SELECT id FROM "Account" WHERE "accountNumber" = '1000000009'`)).rows[0];
  const adminCardAccount = (await account.query(`SELECT id FROM "Account" WHERE "accountNumber" = '1000000010'`)).rows[0];

  const aliceChecking = (await account.query(`SELECT id FROM "Account" WHERE "accountNumber" = '1000000001'`)).rows[0];
  const aliceSavings = (await account.query(`SELECT id FROM "Account" WHERE "accountNumber" = '1000000002'`)).rows[0];
  const aliceLoanAccount = (await account.query(`SELECT id FROM "Account" WHERE "accountNumber" = '1000000005'`)).rows[0];
  const aliceCardAccount = (await account.query(`SELECT id FROM "Account" WHERE "accountNumber" = '1000000006'`)).rows[0];
  const bobChecking = (await account.query(`SELECT id FROM "Account" WHERE "accountNumber" = '1000000003'`)).rows[0];
  const bobSavings = (await account.query(`SELECT id FROM "Account" WHERE "accountNumber" = '1000000004'`)).rows[0];

  // Admin — approved personal loan (full customer demo + admin approvals)
  const adminLoanAppId = randomUUID();
  const adminLoanId = randomUUID();
  const adminLoanPrincipal = 20000;
  const adminLoanRate = 6.9;
  const adminLoanTerm = 48;
  const adminMonthlyPayment =
    Math.round(calculateMonthlyPayment(adminLoanPrincipal, adminLoanRate, adminLoanTerm) * 100) / 100;

  await loan.query(`DELETE FROM "Loan" WHERE "userId" = $1`, [adminRow.id]);
  await loan.query(`DELETE FROM "LoanApplication" WHERE "userId" = $1`, [adminRow.id]);

  await loan.query(`
    INSERT INTO "LoanApplication" (id, "userId", status, "loanType", "requestedAmount", "termMonths", purpose, "underwritingScore", "decisionReason", "createdAt", "updatedAt")
    VALUES ($1, $2, 'APPROVED', 'PERSONAL', $3, $4, 'Office renovation', 780, 'Approved — executive income tier', NOW() - interval '90 days', NOW() - interval '88 days')
  `, [adminLoanAppId, adminRow.id, adminLoanPrincipal, adminLoanTerm]);

  await loan.query(`
    INSERT INTO "Loan" (id, "userId", "applicationId", "accountId", principal, "interestRate", "termMonths", "monthlyPayment", "remainingBalance", status, "createdAt")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', NOW() - interval '88 days')
  `, [
    adminLoanId,
    adminRow.id,
    adminLoanAppId,
    adminLoanAccount.id,
    adminLoanPrincipal,
    adminLoanRate,
    adminLoanTerm,
    adminMonthlyPayment,
    17850.25,
  ]);

  // Alice — approved personal loan
  const aliceLoanAppId = randomUUID();
  const aliceLoanId = randomUUID();
  const loanPrincipal = 15000;
  const loanRate = 7.5;
  const loanTerm = 36;
  const monthlyPayment = Math.round(calculateMonthlyPayment(loanPrincipal, loanRate, loanTerm) * 100) / 100;

  await loan.query(`DELETE FROM "Loan" WHERE "userId" = $1`, [aliceRow.id]);
  await loan.query(`DELETE FROM "LoanApplication" WHERE "userId" = $1`, [aliceRow.id]);

  await loan.query(`
    INSERT INTO "LoanApplication" (id, "userId", status, "loanType", "requestedAmount", "termMonths", purpose, "underwritingScore", "decisionReason", "createdAt", "updatedAt")
    VALUES ($1, $2, 'APPROVED', 'PERSONAL', $3, $4, 'Home improvement and debt consolidation', 742, 'Approved — strong income and payment history', NOW() - interval '60 days', NOW() - interval '58 days')
  `, [aliceLoanAppId, aliceRow.id, loanPrincipal, loanTerm]);

  await loan.query(`
    INSERT INTO "Loan" (id, "userId", "applicationId", "accountId", principal, "interestRate", "termMonths", "monthlyPayment", "remainingBalance", status, "createdAt")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', NOW() - interval '58 days')
  `, [
    aliceLoanId,
    aliceRow.id,
    aliceLoanAppId,
    aliceLoanAccount.id,
    loanPrincipal,
    loanRate,
    loanTerm,
    monthlyPayment,
    13250.75,
  ]);

  // Bob — pending loan application (for admin approval demo)
  await loan.query(`DELETE FROM "LoanApplication" WHERE "userId" = $1 AND status = 'UNDER_REVIEW'`, [bobRow.id]);
  await loan.query(`
    INSERT INTO "LoanApplication" (id, "userId", status, "loanType", "requestedAmount", "termMonths", purpose, "underwritingScore", "createdAt", "updatedAt")
    VALUES ($1, $2, 'UNDER_REVIEW', 'AUTO', 22000, 48, 'Used vehicle purchase', 698, NOW() - interval '2 days', NOW() - interval '2 days')
    ON CONFLICT DO NOTHING
  `, [randomUUID(), bobRow.id]);

  // Admin — approved credit card
  const adminCardAppId = randomUUID();
  const adminCardId = randomUUID();
  const adminCardLimit = 15000;

  await creditCard.query(`DELETE FROM "CreditCard" WHERE "userId" = $1`, [adminRow.id]);
  await creditCard.query(`DELETE FROM "CardApplication" WHERE "userId" = $1`, [adminRow.id]);

  await creditCard.query(`
    INSERT INTO "CardApplication" (id, "userId", status, "requestedLimit", "cardType", "decisionReason", "createdAt", "updatedAt")
    VALUES ($1, $2, 'APPROVED', $3, 'PLATINUM', 'Approved — premium tier', NOW() - interval '60 days', NOW() - interval '58 days')
  `, [adminCardAppId, adminRow.id, adminCardLimit]);

  await creditCard.query(`
    INSERT INTO "CreditCard" (id, "userId", "applicationId", "accountId", "maskedPan", "creditLimit", "availableCredit", status, "expiryDate", "createdAt")
    VALUES ($1, $2, $3, $4, '**** **** **** 9001', $5, 12100, 'ACTIVE', '12/29', NOW() - interval '58 days')
  `, [adminCardId, adminRow.id, adminCardAppId, adminCardAccount.id, adminCardLimit]);

  // Alice — approved credit card
  const aliceCardAppId = randomUUID();
  const aliceCardId = randomUUID();
  const cardLimit = 10000;

  await creditCard.query(`DELETE FROM "CreditCard" WHERE "userId" = $1`, [aliceRow.id]);
  await creditCard.query(`DELETE FROM "CardApplication" WHERE "userId" = $1`, [aliceRow.id]);

  await creditCard.query(`
    INSERT INTO "CardApplication" (id, "userId", status, "requestedLimit", "cardType", "decisionReason", "createdAt", "updatedAt")
    VALUES ($1, $2, 'APPROVED', $3, 'REWARDS', 'Approved — excellent credit profile', NOW() - interval '45 days', NOW() - interval '43 days')
  `, [aliceCardAppId, aliceRow.id, cardLimit]);

  await creditCard.query(`
    INSERT INTO "CreditCard" (id, "userId", "applicationId", "accountId", "maskedPan", "creditLimit", "availableCredit", status, "expiryDate", "createdAt")
    VALUES ($1, $2, $3, $4, '**** **** **** 4829', $5, 7625.40, 'ACTIVE', '09/28', NOW() - interval '43 days')
  `, [aliceCardId, aliceRow.id, aliceCardAppId, aliceCardAccount.id, cardLimit]);

  // Bob — pending card application
  await creditCard.query(`
    INSERT INTO "CardApplication" (id, "userId", status, "requestedLimit", "cardType", "createdAt", "updatedAt")
    SELECT $1, $2, 'UNDER_REVIEW', 5000, 'STANDARD', NOW() - interval '1 day', NOW() - interval '1 day'
    WHERE NOT EXISTS (
      SELECT 1 FROM "CardApplication" WHERE "userId" = $2 AND status = 'UNDER_REVIEW'
    )
  `, [randomUUID(), bobRow.id]);

  // Transactions
  await transaction.query(`DELETE FROM "Transaction" WHERE "userId" = ANY($1)`, [[adminRow.id, aliceRow.id, bobRow.id]]);
  await transaction.query(`DELETE FROM "ScheduledTransfer" WHERE "userId" = ANY($1)`, [[adminRow.id, aliceRow.id]]);
  await transaction.query(`DELETE FROM "Payee" WHERE "userId" = ANY($1)`, [[adminRow.id, aliceRow.id, bobRow.id]]);

  const txRows = [
    [adminRow.id, 'TRANSFER', 'COMPLETED', 1000, adminChecking.id, adminSavings.id, null, 'Monthly reserve transfer', '30 days'],
    [adminRow.id, 'BILL_PAY', 'COMPLETED', 250, adminChecking.id, null, 'Office Supplies Co', 'Bill payment — Office Supplies Co', '14 days'],
    [adminRow.id, 'BILL_PAY', 'COMPLETED', adminMonthlyPayment, adminChecking.id, null, 'Loan Payment', 'Personal loan payment', '5 days'],
    [aliceRow.id, 'TRANSFER', 'COMPLETED', 500, aliceChecking.id, aliceSavings.id, null, 'Monthly savings transfer', '45 days'],
    [aliceRow.id, 'TRANSFER', 'COMPLETED', 250, aliceChecking.id, aliceSavings.id, null, 'Weekly savings', '14 days'],
    [aliceRow.id, 'BILL_PAY', 'COMPLETED', 125.5, aliceChecking.id, null, 'ConEd Electric', 'Bill payment — ConEd Electric', '30 days'],
    [aliceRow.id, 'BILL_PAY', 'COMPLETED', 89.99, aliceChecking.id, null, 'Verizon Wireless', 'Bill payment — Verizon Wireless', '21 days'],
    [aliceRow.id, 'TRANSFER', 'COMPLETED', 15000, null, aliceChecking.id, null, 'Personal loan disbursement', '58 days'],
    [aliceRow.id, 'BILL_PAY', 'COMPLETED', monthlyPayment, aliceChecking.id, null, 'Loan Payment', 'Personal loan payment', '7 days'],
    [bobRow.id, 'TRANSFER', 'COMPLETED', 300, bobChecking.id, bobSavings.id, null, 'Emergency fund contribution', '10 days'],
    [bobRow.id, 'BILL_PAY', 'COMPLETED', 78.25, bobChecking.id, null, 'City Water Dept', 'Bill payment — City Water Dept', '18 days'],
  ] as const;

  for (const [userId, type, status, amount, fromId, toId, payee, desc, age] of txRows) {
    await transaction.query(`
      INSERT INTO "Transaction" (id, "userId", type, status, amount, currency, "fromAccountId", "toAccountId", "payeeName", description, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, 'USD', $6, $7, $8, $9, NOW() - interval '${age}', NOW() - interval '${age}')
    `, [randomUUID(), userId, type, status, amount, fromId, toId, payee, desc]);
  }

  await transaction.query(`
    INSERT INTO "ScheduledTransfer" (id, "userId", "fromAccountId", "toAccountId", amount, frequency, "nextRunAt", active, "createdAt", "updatedAt")
    VALUES
      ($1, $2, $3, $4, 1000, 'MONTHLY', NOW() + interval '8 days', true, NOW() - interval '120 days', NOW()),
      ($5, $6, $7, $8, 500, 'MONTHLY', NOW() + interval '12 days', true, NOW() - interval '90 days', NOW())
  `, [
    randomUUID(),
    adminRow.id,
    adminChecking.id,
    adminSavings.id,
    randomUUID(),
    aliceRow.id,
    aliceChecking.id,
    aliceSavings.id,
  ]);

  for (const [userId, name] of [
    [adminRow.id, 'Office Supplies Co'],
    [adminRow.id, 'Loan Payment'],
    [aliceRow.id, 'ConEd Electric'],
    [aliceRow.id, 'Verizon Wireless'],
    [aliceRow.id, 'Loan Payment'],
    [bobRow.id, 'City Water Dept'],
    [bobRow.id, 'Netflix'],
  ] as const) {
    await transaction.query(`
      INSERT INTO "Payee" (id, "userId", name, "createdAt")
      SELECT $1, $2, $3, NOW()
      WHERE NOT EXISTS (SELECT 1 FROM "Payee" WHERE "userId" = $2 AND name = $3)
    `, [randomUUID(), userId, name]);
  }

  // Notifications
  await notification.query(`DELETE FROM "Notification" WHERE "userId" = ANY($1)`, [[adminRow.id, aliceRow.id, bobRow.id]]);

  const notifications = [
    [adminRow.id, 'Welcome to SecureBank', 'Your admin account includes full banking access for demos.', false, '200 days'],
    [adminRow.id, 'Loan Approved!', `Your personal loan of $${adminLoanPrincipal.toLocaleString()} has been approved.`, true, '88 days'],
    [adminRow.id, 'Credit Card Approved', 'Your Platinum card ending in 9001 is active with a $15,000 limit.', true, '58 days'],
    [aliceRow.id, 'Welcome to SecureBank', 'Your accounts are ready. Explore transfers, bill pay, and more.', false, '180 days'],
    [aliceRow.id, 'Loan Approved!', `Your personal loan of $${loanPrincipal.toLocaleString()} has been approved.`, true, '58 days'],
    [aliceRow.id, 'Credit Card Approved', 'Your Rewards card ending in 4829 is active with a $10,000 limit.', true, '43 days'],
    [aliceRow.id, 'Scheduled Transfer Reminder', 'Your $500 monthly transfer to savings runs in 12 days.', false, '2 days'],
    [bobRow.id, 'Welcome to SecureBank', 'Thanks for joining! Complete your profile to apply for loans and cards.', false, '120 days'],
    [bobRow.id, 'Application Under Review', 'Your auto loan application is being reviewed by our team.', false, '2 days'],
  ] as const;

  for (const [userId, title, message, read, age] of notifications) {
    await notification.query(`
      INSERT INTO "Notification" (id, "userId", title, message, read, "createdAt")
      VALUES ($1, $2, $3, $4, $5, NOW() - interval '${age}')
    `, [randomUUID(), userId, title, message, read]);
  }

  console.log('Demo data seeded successfully!');
  console.log('');
  console.log('Demo credentials (password for all): Demo1234!');
  console.log('  Admin:  admin@bank.demo  — full banking + admin approvals (single demo login)');
  console.log('  Alice:  alice@bank.demo  — 4 accounts, active loan, credit card, transaction history');
  console.log('  Bob:    bob@bank.demo    — 2 accounts, pending loan & card applications');
  console.log('');
  console.log('Admin accounts:');
  console.log('  Executive Checking ····0007  $45,000.00');
  console.log('  Reserve Savings    ····0008  $75,000.00');
  console.log('  Personal Loan (active, $17,850.25 remaining)');
  console.log('  Platinum Credit Card (limit $15,000, $2,900 used)');
  console.log('');
  console.log('Alice accounts:');
  console.log('  Checking ····0001  $28,450.50');
  console.log('  Savings  ····0002  $52,000.00');
  console.log('  Personal Loan (active, $13,250.75 remaining)');
  console.log('  Rewards Credit Card (limit $10,000, $2,374.60 used)');
  console.log('');
  console.log('Admin can approve Bob\'s pending auto loan + standard card applications');

  await Promise.all([
    auth.end(),
    user.end(),
    account.end(),
    transaction.end(),
    notification.end(),
    document.end(),
    loan.end(),
    creditCard.end(),
  ]);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
