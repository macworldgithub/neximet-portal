export interface MailSettings {
  connected: boolean;
  email: string;
  displayName: string;
  notificationsEnabled: boolean;
  serverConfigured: boolean;
}
export interface MailAddress { name: string; address: string }
export interface MailAttachment {
  filename: string;
  size: number;
  contentType?: string;
  inline?: boolean;
  isImage?: boolean;
  preview?: { dataUrl: string; width: number; height: number };
}
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
  attachments?: MailAttachment[];
}
export const addressLabel = (addresses: MailAddress[]) => addresses.map(item => item.name ? `${item.name} <${item.address}>` : item.address).join(', ');
