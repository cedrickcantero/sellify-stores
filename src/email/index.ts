export { sendEmail } from "./send";
export { createResendMailer } from "./resend";
export { createFakeMailer, type FakeMailer } from "./fake";
export { EMAIL_KINDS, type EmailKind, type EmailMessage, type Mailer } from "@/domain/email";
export { escapeHtml, safeHtml } from "@/domain/email-html";
