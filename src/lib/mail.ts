export interface MailSettings {
  connected: boolean;
  email: string;
  displayName: string;
  notificationsEnabled: boolean;
  serverConfigured: boolean;
}
export interface MailAddress { name: string; address: string }
export interface MailMessage {
  uid: number;
  subject: string;
  from: MailAddress[];
  to: MailAddress[];
  cc?: MailAddress[];
  replyTo?: MailAddress[];
  date: string | null;
  seen: boolean;
  text?: string;
  attachments?: { filename: string; size: number }[];
}
export const addressLabel = (addresses: MailAddress[]) => addresses.map(item => item.name ? `${item.name} <${item.address}>` : item.address).join(', ');
