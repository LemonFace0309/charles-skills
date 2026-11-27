"use client";
import { useEffect, useState } from "react";
import { supabaseAdmin } from "@/lib/supabase";

export default function Admin() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabaseAdmin.from("profiles").select("*").then(({ data }) => setRows(data ?? []));
  }, []);
  return (
    <table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}><td>{r.full_name}</td><td>{r.email}</td><td>{r.phone}</td><td>{r.plan}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
