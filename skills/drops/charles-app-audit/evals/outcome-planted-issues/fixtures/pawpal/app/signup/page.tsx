"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SignUp() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);

  async function sendCode() {
    await fetch("/api/otp", { method: "POST", body: JSON.stringify({ phone }) });
    setSent(true);
  }

  async function verify(form: FormData) {
    const { data } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    await supabase.from("profiles").upsert({
      id: data.user!.id,
      full_name: form.get("name"),
      phone,
      sms_marketing: form.get("deals") === "on",
    });
  }

  return (
    <form action={verify}>
      <input name="name" placeholder="Your name" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
      <button type="button" onClick={sendCode}>Text me a code</button>
      {sent && <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" />}
      <label>
        <input type="checkbox" name="deals" defaultChecked /> Send me deals and sitter offers by text
      </label>
      <button type="submit">Create account</button>
    </form>
  );
}
