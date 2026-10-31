export interface AuthUser {
  id: string
  tenantId: string
  name: string
  email: string
  role: string
  permissions: string[]
}

export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'EMAIL' | 'PHONE'

export interface CustomField {
  id: string
  entity: string
  name: string
  key: string
  type: CustomFieldType
  options: string[]
  required: boolean
  position: number
  color: string
}

export type CustomValue = string | number | boolean | null

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: 'ACTIVE' | 'INACTIVE'
  tags: string[]
  customFields: Record<string, CustomValue>
  createdAt: string
  updatedAt: string
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface DashboardSummary {
  customers: { total: number; newThisMonth: number; active: number } | null
  sales: {
    leads: {
      total: number
      newThisMonth: number
      byStatus: Partial<Record<LeadStatus, number>>
      conversionRate: number
    } | null
    deals: {
      openCount: number
      openValue: number
      weightedValue: number
      wonThisMonthCount: number
      wonThisMonthValue: number
    } | null
    funnel: { label: string; value: number }[]
  } | null
  recentActivity: {
    id: string
    module: string
    action: string
    recordId: string | null
    createdAt: string
  }[]
}

export interface UserRef {
  id: string
  name: string
}

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'DISQUALIFIED' | 'CONVERTED'

export interface Lead {
  id: string
  number: number
  name: string
  email: string | null
  phone: string | null
  company: string | null
  source: string
  status: LeadStatus
  score: number
  requirement: string | null
  estimatedValue: string | null // Decimal comes back as a string
  assignedToId: string | null
  assignedTo: UserRef | null
  disqualifyReason: string | null
  convertedCustomerId: string | null
  convertedDealId: string | null
  convertedAt: string | null
  convertedCustomer?: UserRef | null
  deals?: { id: string; number: number; title: string }[]
  createdAt: string
}

export interface LeadList extends Paged<Lead> {
  statusCounts: Partial<Record<LeadStatus, number>>
}

export type StageType = 'OPEN' | 'WON' | 'LOST'

export interface Stage {
  id: string
  name: string
  position: number
  probability: number
  type: StageType
  color: string
}

export interface Pipeline {
  id: string
  name: string
  isDefault: boolean
  stages: Stage[]
}

export interface Deal {
  id: string
  number: number
  title: string
  value: string // Decimal as string
  pipelineId: string
  stageId: string
  stage: Stage
  customerId: string | null
  customer: UserRef | null
  ownerId: string | null
  owner: UserRef | null
  lead: { id: string; number: number; name: string } | null
  expectedCloseDate: string | null
  closedAt: string | null
  lostReason: string | null
  notes: string | null
  stageChangedAt: string
  createdAt: string
}

export const LEAD_STATUS_META: Record<LeadStatus, { label: string; className: string }> = {
  NEW: { label: 'New', className: 'bg-blue-50 text-blue-700' },
  CONTACTED: { label: 'Contacted', className: 'bg-amber-50 text-amber-700' },
  QUALIFIED: { label: 'Qualified', className: 'bg-violet-50 text-violet-700' },
  DISQUALIFIED: { label: 'Disqualified', className: 'bg-slate-100 text-slate-500' },
  CONVERTED: { label: 'Converted', className: 'bg-brand-50 text-brand-700' },
}

export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  DATE: 'Date',
  BOOLEAN: 'Yes / No',
  SELECT: 'Dropdown',
  EMAIL: 'Email',
  PHONE: 'Phone',
}
