import { z } from "zod";

export type RemunerationStatus = "new" | "requested" | "completed" | "active" | "draft" | "cancelled";
export type InstallmentStatus =
  | "planned"
  | "due"
  | "partially_paid"
  | "paid"
  | "cancelled"
  | "new"
  | "requested"
  | "completed";

export type AgreementStatus = "draft" | "active" | "completed" | "cancelled";
export type PaymentStatus = "completed" | "pending_verification" | "failed";
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
  agreement_status?: AgreementStatus | string;
  agreement_date?: string | null;
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
  payments?: RemunerationPayment[];
  timeline?: RemunerationTimelineEvent[];
  notification_preferences?: RemunerationNotificationPreferences | null;
  notification_logs?: NotificationLog[];
  // Calculated metadata
  received_amount?: number;
  remaining_amount?: number;
  overdue_amount?: number;
  planned_installments_total?: number;
  total_distributed_to_team?: number;
  total_undistributed?: number;
  next_due_date?: string | null;
  is_overdue?: boolean;
  progress_percent?: number;
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
  name?: string | null;
  description?: string | null;
  amount: number;
  due_date?: string | null;
  status: InstallmentStatus;
  requested_date: string | null;
  received_date: string | null;
  received_amount: number;
  remaining_balance?: number;
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
  status?: PaymentStatus | string;
  notes: string | null;
  recorded_by: string;
  created_at: string;
  team_splits?: PaymentTeamSplit[];
  proofs?: RemunerationProof[];
  installment?: {
    id: string;
    installment_number: number;
    name?: string | null;
    amount: number;
    due_date?: string | null;
  } | null;
}

export interface PaymentTeamSplit {
  id: string;
  payment_id: string;
  remuneration_id: string;
  team_user_id: string;
  member_name: string;
  role?: string | null;
  amount: number;
  percentage?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
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

export interface ClientEmailSettings {
  payment_received: boolean;
  payment_receipt: boolean;
  installment_created: boolean;
  installment_updated: boolean;
  payment_reminder: boolean;
  installment_due: boolean;
  installment_overdue: boolean;
}

export interface TeamEventSetting {
  email: boolean;
  in_app: boolean;
  sms?: boolean;
}

export interface TeamNotificationSettings {
  payment_received: TeamEventSetting;
  payment_allocated: TeamEventSetting;
  split_updated: TeamEventSetting;
  allocation_removed: TeamEventSetting;
  status_changed: TeamEventSetting;
}

export interface RemunerationNotificationPreferences {
  id?: string;
  remuneration_id: string;
  client_email_settings: ClientEmailSettings;
  team_notification_settings: TeamNotificationSettings;
  client_emails?: ClientEmailSettings;
  team_notifications?: TeamNotificationSettings;
  require_full_split: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InAppNotification {
  id: string;
  user_id?: string;
  title: string;
  message: string;
  is_read: boolean;
  link_url?: string | null;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  remuneration_id?: string | null;
  installment_id?: string | null;
  payment_id?: string | null;
  recipient: string;
  recipient_name?: string | null;
  recipient_type: "client" | "team_member" | "admin";
  notification_type: string;
  channel: "email" | "in_app" | "sms";
  status: "sent" | "failed" | "skipped";
  title?: string | null;
  message?: string | null;
  failure_reason?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface RemunerationStats {
  totalRemuneration: number;
  totalReceived: number;
  totalPending: number;
  totalOverdue: number;
  totalPlannedInstallments?: number;
  totalDistributedToTeam?: number;
  totalUndistributed?: number;
  upcomingPayments: {
    id: string;
    remunerationId: string;
    projectName: string;
    clientName: string;
    installmentNumber: number;
    amount: number;
    currency: string;
    dueDate?: string | null;
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
    dueDate?: string | null;
    status: InstallmentStatus;
  }[];
}

// ==============================================================================
// Default Notification Preferences
// ==============================================================================
export const DEFAULT_CLIENT_EMAIL_SETTINGS: ClientEmailSettings = {
  payment_received: true,
  payment_receipt: true,
  installment_created: true,
  installment_updated: false,
  payment_reminder: false,
  installment_due: true,
  installment_overdue: true,
};

export const DEFAULT_TEAM_NOTIFICATION_SETTINGS: TeamNotificationSettings = {
  payment_received: { email: true, in_app: true },
  payment_allocated: { email: true, in_app: true },
  split_updated: { email: true, in_app: true },
  allocation_removed: { email: true, in_app: true },
  status_changed: { email: false, in_app: true },
};

// ==============================================================================
// Zod Validation Schemas
// ==============================================================================

export const installmentInputSchema = z.object({
  installmentNumber: z.number().int().positive(),
  name: z.string().max(100).optional().nullable(),
  amount: z.number().positive("Amount must be a positive number"),
  dueDate: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val : null)),
  description: z.string().max(1000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  status: z
    .enum(["planned", "due", "partially_paid", "paid", "cancelled", "new", "requested", "completed"])
    .optional()
    .default("planned"),
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

export const createRemunerationSchema = z
  .object({
    projectId: z.string().uuid("Invalid project ID"),
    totalAmount: z.number().positive("Total remuneration must be greater than 0"),
    currency: z.string().default("INR"),
    agreementDate: z.string().optional().nullable(),
    agreementStatus: z.enum(["draft", "active", "completed", "cancelled"]).optional().default("active"),
    paymentMethod: z.enum(["single", "installments"]),
    notes: z.string().max(2000).optional().nullable(),
    sendReceiptEmail: z.boolean().optional().default(true),
    splits: z.array(remunerationSplitSchema).optional().default([]),
    installments: z.array(installmentInputSchema).min(1, "At least one payment installment is required"),
  })
  .refine(
    (data) => {
      const sum = data.installments.reduce((acc, curr) => acc + curr.amount, 0);
      return Math.abs(sum - data.totalAmount) < 0.01;
    },
    {
      message: "Sum of installment amounts must equal the total remuneration amount.",
      path: ["installments"],
    }
  );

export const paymentTeamSplitInputSchema = z.object({
  teamMemberId: z.string().min(1, "Team member is required"),
  name: z.string().min(1, "Name is required"),
  role: z.string().optional().nullable(),
  percentage: z.number().min(0).max(100).optional().nullable(),
  amount: z.number().min(0, "Split amount cannot be negative"),
  notes: z.string().max(500).optional().nullable(),
});

export const recordPaymentSchema = z
  .object({
    installmentId: z.string().uuid("Invalid installment ID").optional(),
    receivedAmount: z.number().positive("Received amount must be greater than 0"),
    receivedDate: z.string().min(1, "Received date is required"),
    paymentMethod: z.enum(["UPI", "Bank Transfer", "Cash", "Card", "Other"]),
    paymentReference: z.string().max(200).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    sendEmail: z.boolean().optional().default(true),
    notifyTeam: z.boolean().optional().default(true),
    teamSplits: z.array(paymentTeamSplitInputSchema).optional().default([]),
    requireFullSplit: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      const totalSplit = data.teamSplits.reduce((acc, curr) => acc + curr.amount, 0);
      return totalSplit <= data.receivedAmount + 0.01;
    },
    {
      message: "Total team splits cannot exceed the actual payment amount.",
      path: ["teamSplits"],
    }
  )
  .refine(
    (data) => {
      if (!data.requireFullSplit || data.teamSplits.length === 0) return true;
      const totalSplit = data.teamSplits.reduce((acc, curr) => acc + curr.amount, 0);
      return Math.abs(totalSplit - data.receivedAmount) < 0.01;
    },
    {
      message: "The full payment amount must be distributed when full distribution is required.",
      path: ["teamSplits"],
    }
  );

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

export function getStatusBadgeConfig(status: RemunerationStatus | InstallmentStatus | string) {
  switch (status) {
    case "completed":
    case "paid":
      return {
        label: "Paid",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        indicator: "bg-emerald-500",
      };
    case "partially_paid":
      return {
        label: "Partially Paid",
        bg: "bg-violet-50 text-violet-700 border-violet-200",
        indicator: "bg-violet-500",
      };
    case "requested":
    case "due":
      return {
        label: "Due",
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        indicator: "bg-amber-500",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        bg: "bg-zinc-100 text-zinc-600 border-zinc-200",
        indicator: "bg-zinc-400",
      };
    case "active":
      return {
        label: "Active",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        indicator: "bg-emerald-500",
      };
    case "draft":
      return {
        label: "Draft",
        bg: "bg-zinc-100 text-zinc-700 border-zinc-200",
        indicator: "bg-zinc-400",
      };
    case "planned":
    case "new":
    default:
      return {
        label: "Planned",
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        indicator: "bg-blue-500",
      };
  }
}
