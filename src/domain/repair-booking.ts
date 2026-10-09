import { z } from "zod";

const EMAIL_MESSAGE = "Enter an email like you@example.com.";

// What a customer types to book a repair online.
export const BookingCustomer = z.object({
  name: z
    .string({ error: "Enter your name." })
    .trim()
    .min(1, "Enter your name.")
    .max(80, "Use 80 characters or fewer for your name."),
  phone: z
    .string({ error: "Enter a phone number like 085 123 4567." })
    .trim()
    .regex(/^[+\d ]{6,20}$/, "Enter a phone number like 085 123 4567.")
    .refine((phone) => phone.replace(/\D/g, "").length >= 6, "Enter a phone number like 085 123 4567."),
  email: z
    .string({ error: EMAIL_MESSAGE })
    .trim()
    .max(254, EMAIL_MESSAGE)
    .pipe(z.email({ error: EMAIL_MESSAGE })),
});

export type BookingCustomer = z.output<typeof BookingCustomer>;
