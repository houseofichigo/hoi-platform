import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  createAdminNote,
  getAdminNotes,
  updateAdminNoteStatus,
} from "@/lib/admin/admin.functions";

type EntityType = "user" | "workspace" | "library_item" | "billing" | "support";

export function AdminNotesPanel({
  entityType,
  entityId,
  title = "Internal notes",
}: {
  entityType: EntityType;
  entityId: string;
  title?: string;
}) {
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const getNotes = useServerFn(getAdminNotes);
  const createNote = useServerFn(createAdminNote);
  const updateNote = useServerFn(updateAdminNoteStatus);
  const queryKey = ["admin", "notes", entityType, entityId];

  const { data: notes = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getNotes({ data: { entityType, entityId } }),
  });

  const add = useMutation({
    mutationFn: () => createNote({ data: { entityType, entityId, note } }),
    onSuccess: () => {
      setNote("");
      toast.success("Note added");
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const setStatus = useMutation({
    mutationFn: (args: { noteId: string; status: "open" | "reviewed" | "closed" }) =>
      updateNote({ data: args }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <section className="rounded-md border border-chalk bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow-muted">{title}</p>
          <p className="mt-1 text-[12px] text-slate">
            Private House of Ichigo context. Customers cannot see these notes.
          </p>
        </div>
        <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] text-slate">
          {notes.length}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Add a customer success, support, billing, or editorial note..."
          className="input text-[13px]"
        />
        <button
          type="button"
          onClick={() => add.mutate()}
          disabled={add.isPending || note.trim().length < 2}
          className="btn-ichigo btn-ichigo-primary text-[12px] disabled:opacity-50"
        >
          {add.isPending ? "Adding..." : "Add note"}
        </button>
      </div>

      <div className="mt-4 divide-y divide-chalk">
        {isLoading ? (
          <p className="py-4 text-[13px] text-slate">Loading notes...</p>
        ) : notes.length === 0 ? (
          <p className="py-4 text-[13px] text-slate">No notes yet.</p>
        ) : (
          notes.map((n) => (
            <article key={n.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-navy">{n.note}</p>
                <select
                  value={n.status}
                  onChange={(e) =>
                    setStatus.mutate({
                      noteId: n.id,
                      status: e.target.value as "open" | "reviewed" | "closed",
                    })
                  }
                  className="rounded-md border border-chalk bg-paper px-2 py-1 text-[11px] text-slate"
                >
                  <option value="open">Open</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <p className="mt-2 text-[11px] text-slate">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
