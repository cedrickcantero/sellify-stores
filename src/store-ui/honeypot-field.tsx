import { HONEYPOT_FIELD } from "@/domain/abuse";

// Put inside every public store form. Hidden from people and assistive
// technology; a bot that fills it is caught by isHoneypotTripped().
export function HoneypotField() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Leave this empty
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
