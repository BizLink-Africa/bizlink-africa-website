export const SERVICE_CATALOG = [
  { value: 'ai_sales_agent', label: 'AI Sales Agent' },
  { value: 'ai_customer_care_agent', label: 'AI Customer Care Agent' },
  { value: 'social_commerce_automation', label: 'Social Commerce Automation' },
  { value: 'ecommerce_store_setup', label: 'E-Commerce & Online Store Setup' },
  { value: 'whatsapp_business_api', label: 'WhatsApp Business API Integration' },
  { value: 'system_api_integration', label: 'System & API Integration' },
  { value: 'crm_customer_data_automation', label: 'CRM & Customer Data Automation' },
  { value: 'business_workflow_automation', label: 'Business Workflow Automation' },
  { value: 'ict_consulting', label: 'ICT Consulting & Digital Transformation' },
  { value: 'payment_integration_support', label: 'Payment Integration Support' },
] as const;

export type ServiceKey = (typeof SERVICE_CATALOG)[number]['value'];

export const SERVICE_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export type ServiceStatus = (typeof SERVICE_STATUSES)[number]['value'];

// Delivery/rollout workflow — separate dimension from `status` above.
// `status` says whether the service is switched on for billing/use;
// `delivery_status` says where Operations is in actually rolling it out.
export const DELIVERY_STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]['value'];

export interface ClientService {
  id: string;
  client_id: string;
  service_key: ServiceKey;
  status: ServiceStatus;
  activated_at: string | null;
  notes: string | null;
  delivery_status: DeliveryStatus;
  scheduled_date: string | null;
  delivery_started_at: string | null;
  delivered_at: string | null;
  assigned_to: string | null;
  delivery_notes: string | null;
  created_at: string;
  updated_at: string;
}
