import { z } from "zod";

export type RemunerationStatus = "new" | "requested" | "completed";
export type InstallmentStatus = "new" | "requested" | "completed";
export type RemunerationPaymentMethod = "single" | "installments";
export type PaymentMethodType = "UPI" | "Bank Transfer" | "Cash" | "Card" | "Other";

export interface RemunerationRecord {
  id: string;
  project_id: string;
  created_by: string;
  total_amount: number;
  currency: string;
  payment_method: RemunerationPaymentMethod;
  status: RemunerationStatus;
  notes: string | null;
  send_receipt_email?: boolean;
  splits?: RemunerationSplit[];
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: {
    id: string;
    name: string;
    owner_id: string;
  } | null;
  client?: {
    id: string;
    name: string;
    email: string | null;
    login_id: string;
  } | null;
  installments?: RemunerationInstallment[];
  // Calculated metadata
  received_amount?: number;
  remaining_amount?: number;
  next_due_date?: string | null;
  is_overdue?: boolean;
}

export interface RemunerationSplit {
  id?: string;
  teamMemberId: string;
  name: string;
  role?: string | null;
  percentage?: number | null;
  amount: number;
  notes?: string | null;
}

export interface RemunerationInstallment {
  id: string;
  remuneration_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: InstallmentStatus;
  requested_date: string | null;
  received_date: string | null;
  received_amount: number;
  payment_method: PaymentMethodType | string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  proofs?: RemunerationProof[];
  payments?: RemunerationPayment[];
  is_overdue?: boolean;
}

export interface RemunerationPayment {
  id: string;
  remuneration_id: string;
  installment_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethodType | string;
  payment_reference: string | null;
  notes: string | null;
  recorded_by: string;
  created_at: string;
}

export interface RemunerationProof {
  id: string;
  remuneration_id: string;
  installment_id: string;
  payment_id: string | null;
  file_name: string;
  storage_key: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
  download_url?: string;
}

export interface RemunerationTimelineEvent {
  id: string;
  remuneration_id: string;
  installment_id: string | null;
  actor_id: string;
  actor_name: string;
  action: string;
  title: string;
  description: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface RemunerationStats {
  totalRemuneration: number;
  totalReceived: number;
  totalPending: number;
  totalOverdue: number;
  upcomingPayments: {
    id: string;
    remunerationId: string;
    projectName: string;
    clientName: string;
    installmentNumber: number;
    amount: number;
    currency: string;
    dueDate: string;
    status: InstallmentStatus;
  }[];
  recentPayments: {
    id: string;
    remunerationId: string;
    projectName: string;
    clientName: string;
    amount: number;
    currency: string;
    receivedDate: string;
    paymentMethod: string;
    paymentReference: string | null;
  }[];
  overduePayments: {
    id: string;
    remunerationId: string;
    projectName: string;
    clientName: string;
    installmentNumber: number;
    amount: number;
    currency: string;
    dueDate: string;
    status: InstallmentStatus;
  }[];
}

// ==============================================================================
// Zod Validation Schemas
// ==============================================================================

export const installmentInputSchema = z.object({
  installmentNumber: z.number().int().positive(),
  amount: z.number().positive("Amount must be a positive number"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format"),
  notes: z.string().max(1000).optional().nullable(),
});

export const remunerationSplitSchema = z.object({
  id: z.string().optional(),
  teamMemberId: z.string().min(1, "Team member is required"),
  name: z.string().min(1, "Name is required"),
  role: z.string().optional().nullable(),
  percentage: z.number().min(0).max(100).optional().nullable(),
  amount: z.number().min(0, "Split amount must be positive"),
  notes: z.string().max(500).optional().nullable(),
});

export const createRemunerationSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  totalAmount: z.number().positive("Total remuneration must be greater than 0"),
  currency: z.string().default("INR"),
  paymentMethod: z.enum(["single", "installments"]),
  notes: z.string().max(2000).optional().nullable(),
  sendReceiptEmail: z.boolean().optional().default(true),
  splits: z.array(remunerationSplitSchema).optional().default([]),
  installments: z.array(installmentInputSchema).min(1, "At least one payment installment is required"),
}).refine((data) => {
  // Enforce sum of installments == totalAmount with 2 decimal precision
  const sum = data.installments.reduce((acc, curr) => acc + curr.amount, 0);
  return Math.abs(sum - data.totalAmount) < 0.01;
}, {
  message: "Sum of installment amounts must equal the total remuneration amount.",
  path: ["installments"],
});

export const recordPaymentSchema = z.object({
  receivedAmount: z.number().positive("Received amount must be greater than 0"),
  receivedDate: z.string().min(1, "Received date is required"),
  paymentMethod: z.enum(["UPI", "Bank Transfer", "Cash", "Card", "Other"]),
  paymentReference: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  sendEmail: z.boolean().optional().default(true),
});

// ==============================================================================
// Formatting Utilities
// ==============================================================================

export function formatCurrency(amount: number, currency: string = "INR"): string {
  const symbolMap: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };
  const symbol = symbolMap[currency.toUpperCase()] || currency;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${symbol}${formatted}`;
}

export function getStatusBadgeConfig(status: RemunerationStatus | InstallmentStatus) {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        indicator: "bg-emerald-500",
      };
    case "requested":
      return {
        label: "Requested",
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        indicator: "bg-amber-500",
      };
    case "new":
    default:
      return {
        label: "New",
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        indicator: "bg-blue-500",
      };
  }
}
