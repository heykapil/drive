"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingState, ...props }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} {...props}>
      {pending ? pendingState : children}
    </button>
  );
}
