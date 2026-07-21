export type UserRole = 'customer' | 'admin';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  mfaVerified?: boolean;
}

export interface UserProfile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  employmentStatus?: string;
  annualIncome?: number;
  profileComplete: boolean;
}

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'LOAN';

export interface Account {
  id: string;
  userId: string;
  accountNumber: string;
  type: AccountType;
  name: string;
  balance: number;
  currency: string;
  status: 'ACTIVE' | 'CLOSED' | 'FROZEN';
  createdAt: string;
}

export type TransactionType = 'TRANSFER' | 'BILL_PAY' | 'DEPOSIT' | 'WITHDRAWAL' | 'LOAN_DISBURSEMENT' | 'CARD_PAYMENT';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  fromAccountId?: string;
  toAccountId?: string;
  payeeName?: string;
  description?: string;
  createdAt: string;
}

export type ApplicationStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DENIED';

export interface CardApplication {
  id: string;
  userId: string;
  status: ApplicationStatus;
  requestedLimit: number;
  cardType: string;
  decisionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCard {
  id: string;
  userId: string;
  applicationId: string;
  accountId: string;
  maskedPan: string;
  creditLimit: number;
  availableCredit: number;
  status: 'ACTIVE' | 'BLOCKED' | 'CLOSED';
  expiryDate: string;
}

export interface LoanApplication {
  id: string;
  userId: string;
  status: ApplicationStatus;
  loanType: string;
  requestedAmount: number;
  termMonths: number;
  purpose: string;
  decisionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  userId: string;
  applicationId: string;
  accountId: string;
  principal: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  remainingBalance: number;
  status: 'ACTIVE' | 'PAID_OFF' | 'DEFAULTED';
}

export type DocumentType = 'GOVERNMENT_ID' | 'PROOF_OF_INCOME' | 'PROOF_OF_ADDRESS';
export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface Document {
  id: string;
  userId: string;
  type: DocumentType;
  fileName: string;
  status: DocumentStatus;
  uploadedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface ScheduledTransfer {
  id: string;
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  frequency: ScheduleFrequency;
  nextRunAt: string;
  active: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
